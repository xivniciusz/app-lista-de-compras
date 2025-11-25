import os
from datetime import datetime, timedelta, timezone

os.environ.setdefault("DATABASE_URL", "sqlite:///./test_hist.db")

from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine  # noqa: E402
from sqlalchemy.orm import sessionmaker  # noqa: E402

from main import app, Base, get_db  # noqa: E402
from models import Lista, Item  # noqa: E402

engine = create_engine(os.environ["DATABASE_URL"], connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


def setup_function(_: object):
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)


def teardown_module(_: object):
    Base.metadata.drop_all(bind=engine)


client = TestClient(app)


def criar_lista(db, nome, finalizada=False, itens=None, finalizada_em=None):
    lista = Lista(
        nome=nome,
        finalizada=finalizada,
        finalizada_em=finalizada_em,
    )
    db.add(lista)
    db.flush()
    for idx, dados in enumerate(itens or []):
        item = Item(
            lista_id=lista.id,
            nome=dados.get("nome", f"Item {idx+1}"),
            quantidade=dados.get("quantidade", 1),
            comprado=dados.get("comprado", False),
            ordem=dados.get("ordem", idx),
        )
        db.add(item)
    db.commit()
    db.refresh(lista)
    return lista


def test_historico_listagem_aplica_busca_e_periodo():
    db = TestingSessionLocal()
    agora = datetime.now(timezone.utc)
    criar_lista(
        db,
        nome="Feira semanal",
        finalizada=True,
        finalizada_em=agora - timedelta(days=2),
        itens=[{"nome": "Banana"}],
    )
    criar_lista(
        db,
        nome="Viagem",
        finalizada=True,
        finalizada_em=agora - timedelta(days=40),
        itens=[{"nome": "Protetor"}],
    )
    db.close()

    resp = client.get("/api/historico", params={"busca": "Feira", "periodo": "7d"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["data"]) == 1
    assert data["data"][0]["nome"] == "Feira semanal"
    assert data["data"][0]["preview_itens"][0]["nome"] == "Banana"


def test_restaurar_lista_reseta_itens_e_nome():
    db = TestingSessionLocal()
    origem = criar_lista(
        db,
        nome="Compras julho",
        finalizada=True,
        finalizada_em=datetime.now(timezone.utc) - timedelta(days=1),
        itens=[{"nome": "Arroz", "comprado": True, "ordem": 0}, {"nome": "Feijão", "comprado": False, "ordem": 1}],
    )
    db.close()

    resp = client.post(f"/api/historico/restaurar/{origem.id}")
    assert resp.status_code == 200
    restaurada = resp.json()
    assert restaurada["finalizada"] is False
    assert "restaurada" in restaurada["nome"].lower()

    db = TestingSessionLocal()
    itens_restaurados = db.query(Item).filter(Item.lista_id == restaurada["id"]).order_by(Item.ordem.asc()).all()
    assert len(itens_restaurados) == 2
    assert all(not item.comprado for item in itens_restaurados)
    assert [item.nome for item in itens_restaurados] == ["Arroz", "Feijão"]
    db.close()


def test_duplicar_lista_preserva_status_e_itens():
    db = TestingSessionLocal()
    origem = criar_lista(
        db,
        nome="Churrasco",
        finalizada=True,
        finalizada_em=datetime.now(timezone.utc) - timedelta(days=3),
        itens=[{"nome": "Carvão", "comprado": True, "ordem": 0}, {"nome": "Carne", "comprado": False, "ordem": 1}],
    )
    db.close()

    resp = client.post(f"/api/historico/duplicar/{origem.id}")
    assert resp.status_code == 200
    duplicada = resp.json()
    assert duplicada["finalizada"] is False
    db = TestingSessionLocal()
    itens_duplicados = db.query(Item).filter(Item.lista_id == duplicada["id"]).order_by(Item.ordem.asc()).all()
    assert len(itens_duplicados) == 2
    assert [item.comprado for item in itens_duplicados] == [True, False]
    assert {item.lista_id for item in itens_duplicados} == {duplicada["id"]}
    db.close()


def test_nome_personalizado_respeitado_com_sufixo_em_conflito():
    db = TestingSessionLocal()
    criar_lista(
        db,
        nome="Quebra",
        finalizada=False,
        itens=[{"nome": "Item"}],
    )
    origem = criar_lista(
        db,
        nome="Quebra",
        finalizada=True,
        finalizada_em=datetime.now(timezone.utc),
        itens=[{"nome": "Item 1"}],
    )
    db.close()

    resp = client.post(f"/api/historico/duplicar/{origem.id}", json={"nome": "Quebra"})
    assert resp.status_code == 200
    novo = resp.json()
    assert novo["nome"].startswith("Quebra")
    assert "cópia" in novo["nome"].lower()


def test_historico_previas_limitadas_a_tres():
    db = TestingSessionLocal()
    itens = [{"nome": f"Item {i}", "ordem": i} for i in range(5)]
    criar_lista(
        db,
        nome="Mega lista",
        finalizada=True,
        finalizada_em=datetime.now(timezone.utc),
        itens=itens,
    )
    db.close()

    resp = client.get("/api/historico", params={"limit": 1})
    payload = resp.json()
    preview = payload["data"][0]["preview_itens"]
    assert len(preview) == 3
    assert preview[0]["nome"] == "Item 0"
