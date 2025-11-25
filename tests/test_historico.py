from datetime import datetime, timedelta, timezone

from models import Lista, Item


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


def test_historico_listagem_aplica_busca_e_periodo(db_session, client):
    agora = datetime.now(timezone.utc)
    criar_lista(
        db_session,
        nome="Feira semanal",
        finalizada=True,
        finalizada_em=agora - timedelta(days=2),
        itens=[{"nome": "Banana"}],
    )
    criar_lista(
        db_session,
        nome="Viagem",
        finalizada=True,
        finalizada_em=agora - timedelta(days=40),
        itens=[{"nome": "Protetor"}],
    )

    resp = client.get("/api/historico", params={"busca": "Feira", "periodo": "7d"})
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["data"]) == 1
    assert data["data"][0]["nome"] == "Feira semanal"
    assert data["data"][0]["preview_itens"][0]["nome"] == "Banana"


def test_restaurar_lista_reseta_itens_e_nome(db_session, client, session_factory):
    origem = criar_lista(
        db_session,
        nome="Compras julho",
        finalizada=True,
        finalizada_em=datetime.now(timezone.utc) - timedelta(days=1),
        itens=[{"nome": "Arroz", "comprado": True, "ordem": 0}, {"nome": "Feijão", "comprado": False, "ordem": 1}],
    )

    resp = client.post(f"/api/historico/restaurar/{origem.id}")
    assert resp.status_code == 200
    restaurada = resp.json()
    assert restaurada["finalizada"] is False
    assert "restaurada" in restaurada["nome"].lower()

    verificar = session_factory()
    try:
        itens_restaurados = (
            verificar.query(Item)
            .filter(Item.lista_id == restaurada["id"])
            .order_by(Item.ordem.asc())
            .all()
        )
    finally:
        verificar.close()
    assert len(itens_restaurados) == 2
    assert all(not item.comprado for item in itens_restaurados)
    assert [item.nome for item in itens_restaurados] == ["Arroz", "Feijão"]


def test_duplicar_lista_preserva_status_e_itens(db_session, client, session_factory):
    origem = criar_lista(
        db_session,
        nome="Churrasco",
        finalizada=True,
        finalizada_em=datetime.now(timezone.utc) - timedelta(days=3),
        itens=[{"nome": "Carvão", "comprado": True, "ordem": 0}, {"nome": "Carne", "comprado": False, "ordem": 1}],
    )

    resp = client.post(f"/api/historico/duplicar/{origem.id}")
    assert resp.status_code == 200
    duplicada = resp.json()
    assert duplicada["finalizada"] is False
    verificar = session_factory()
    try:
        itens_duplicados = (
            verificar.query(Item)
            .filter(Item.lista_id == duplicada["id"])
            .order_by(Item.ordem.asc())
            .all()
        )
    finally:
        verificar.close()
    assert len(itens_duplicados) == 2
    assert [item.comprado for item in itens_duplicados] == [True, False]
    assert {item.lista_id for item in itens_duplicados} == {duplicada["id"]}


def test_nome_personalizado_respeitado_com_sufixo_em_conflito(db_session, client):
    criar_lista(
        db_session,
        nome="Quebra",
        finalizada=False,
        itens=[{"nome": "Item"}],
    )
    origem = criar_lista(
        db_session,
        nome="Quebra",
        finalizada=True,
        finalizada_em=datetime.now(timezone.utc),
        itens=[{"nome": "Item 1"}],
    )

    resp = client.post(f"/api/historico/duplicar/{origem.id}", json={"nome": "Quebra"})
    assert resp.status_code == 200
    novo = resp.json()
    assert novo["nome"].startswith("Quebra")
    assert "cópia" in novo["nome"].lower()


def test_historico_previas_limitadas_a_tres(db_session, client):
    itens = [{"nome": f"Item {i}", "ordem": i} for i in range(5)]
    criar_lista(
        db_session,
        nome="Mega lista",
        finalizada=True,
        finalizada_em=datetime.now(timezone.utc),
        itens=itens,
    )

    resp = client.get("/api/historico", params={"limit": 1})
    payload = resp.json()
    preview = payload["data"][0]["preview_itens"]
    assert len(preview) == 3
    assert preview[0]["nome"] == "Item 0"
