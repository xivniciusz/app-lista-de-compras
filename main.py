from fastapi import FastAPI, HTTPException, Depends, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker, Session
from datetime import datetime, timezone
import os
from dotenv import load_dotenv
from typing import Generator, Optional
from models import Base, Lista, Item

# Carrega variáveis de ambiente (.env)
load_dotenv()

# Recupera URL do banco (DATABASE_URL) - DATABASE_PUBLIC_URL pode ser usada em documentação
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL não definida no ambiente")

# Configuração do SQLAlchemy
engine = create_engine(DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

app = FastAPI(title="API Lista de Compras")

# Configuração CORS (simples) - ajustar conforme necessidade
origins = ["*"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Dependência para obter sessão
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Função util para converter modelo em dict
def lista_to_dict(l: Lista, db: Session = None):
    itens_count = 0
    if db is not None:
        itens_count = db.query(func.count(Item.id)).filter(Item.lista_id == l.id).scalar()
    return {
        "id": l.id,
        "nome": l.nome,
        "criado_em": l.criado_em.isoformat(),
        "finalizada": l.finalizada,
        "finalizada_em": l.finalizada_em.isoformat() if l.finalizada_em else None,
        "itens_count": itens_count,
    }

# Função para converter item em dict
def item_to_dict(i: Item):
    return {
        "id": i.id,
        "lista_id": i.lista_id,
        "nome": i.nome,
        "quantidade": i.quantidade,
        "comprado": i.comprado,
        "ordem": i.ordem,
        "criado_em": i.criado_em.isoformat() if i.criado_em else None,
    }

# Endpoints de listas

@app.get("/api/listas")
def listar_listas(db: Session = Depends(get_db)):
    listas = db.query(Lista).order_by(Lista.criado_em.desc()).all()
    return [lista_to_dict(l, db) for l in listas]

@app.post("/api/listas")
def criar_lista(payload: dict, db: Session = Depends(get_db)):
    nome = (payload.get("nome") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome é obrigatório")
    nova = Lista(nome=nome)
    db.add(nova)
    db.commit()
    db.refresh(nova)
    return lista_to_dict(nova)

@app.put("/api/listas/{lista_id}")
def renomear_lista(lista_id: int, payload: dict, db: Session = Depends(get_db)):
    lista = db.query(Lista).filter(Lista.id == lista_id).first()
    if not lista:
        raise HTTPException(status_code=404, detail="Lista não encontrada")
    nome = (payload.get("nome") or "").strip()
    if not nome:
        raise HTTPException(status_code=400, detail="Nome é obrigatório")
    lista.nome = nome
    db.commit()
    db.refresh(lista)
    return lista_to_dict(lista)

@app.delete("/api/listas/{lista_id}")
def excluir_lista(lista_id: int, db: Session = Depends(get_db)):
    lista = db.query(Lista).filter(Lista.id == lista_id).first()
    if not lista:
        raise HTTPException(status_code=404, detail="Lista não encontrada")
    db.delete(lista)
    db.commit()
    return {"ok": True}

@app.post("/api/listas/{lista_id}/itens")
def adicionar_item(lista_id: int, payload: dict, db: Session = Depends(get_db)):
    lista = db.query(Lista).filter(Lista.id == lista_id).first()
    if not lista:
        raise HTTPException(status_code=404, detail="Lista não encontrada")
    nome = (payload.get("nome") or "").strip()
    qtd = payload.get("quantidade") or 1
    if not nome:
        raise HTTPException(status_code=400, detail="Nome do item é obrigatório")
    maior_ordem = db.query(func.max(Item.ordem)).filter(Item.lista_id == lista.id).scalar()
    proxima_ordem = (maior_ordem + 1) if maior_ordem is not None else 0
    item = Item(lista_id=lista.id, nome=nome, quantidade=int(qtd), ordem=proxima_ordem)
    db.add(item)
    db.commit()
    db.refresh(item)
    return item_to_dict(item)

@app.get("/api/listas/{lista_id}/itens")
def listar_itens(lista_id: int, db: Session = Depends(get_db)):
    lista = db.query(Lista).filter(Lista.id == lista_id).first()
    if not lista:
        raise HTTPException(status_code=404, detail="Lista não encontrada")
    itens = (
        db.query(Item)
        .filter(Item.lista_id == lista_id)
        .order_by(Item.ordem.asc(), Item.criado_em.asc())
        .all()
    )
    return [item_to_dict(i) for i in itens]

@app.put("/api/listas/{lista_id}/itens/ordenar")
def reordenar_itens(lista_id: int, payload: dict, db: Session = Depends(get_db)):
    lista = db.query(Lista).filter(Lista.id == lista_id).first()
    if not lista:
        raise HTTPException(status_code=404, detail="Lista não encontrada")
    nova_ordem = payload.get("ordem") if isinstance(payload, dict) else None
    if not nova_ordem or not isinstance(nova_ordem, list):
        raise HTTPException(status_code=400, detail="Informe uma lista de IDs em 'ordem'")

    itens = db.query(Item).filter(Item.lista_id == lista_id).all()
    itens_por_id = {i.id: i for i in itens}
    ids_recebidos = []
    for raw_id in nova_ordem:
        try:
            iid = int(raw_id)
        except (TypeError, ValueError):
            raise HTTPException(status_code=400, detail="IDs de item inválidos")
        if iid not in itens_por_id:
            raise HTTPException(status_code=400, detail=f"Item {iid} não pertence à lista")
        ids_recebidos.append(iid)

    for pos, iid in enumerate(ids_recebidos):
        itens_por_id[iid].ordem = pos

    restantes = [i for i in itens if i.id not in ids_recebidos]
    restantes.sort(key=lambda it: (it.ordem, it.criado_em))
    offset = len(ids_recebidos)
    for idx, item in enumerate(restantes):
        item.ordem = offset + idx

    db.commit()
    return {"ok": True}


@app.put("/api/listas/{lista_id}/itens/{item_id}")
def atualizar_item(lista_id: int, item_id: int, payload: dict, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id, Item.lista_id == lista_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    if "nome" in payload:
        nome = (payload.get("nome") or "").strip()
        if not nome:
            raise HTTPException(status_code=400, detail="Nome do item é obrigatório")
        item.nome = nome
    if "quantidade" in payload:
        qtd = payload.get("quantidade")
        if qtd is not None:
            item.quantidade = int(qtd)
    if "comprado" in payload:
        item.comprado = bool(payload.get("comprado"))
    db.commit()
    db.refresh(item)
    return item_to_dict(item)

@app.delete("/api/listas/{lista_id}/itens/{item_id}")
def excluir_item(lista_id: int, item_id: int, db: Session = Depends(get_db)):
    item = db.query(Item).filter(Item.id == item_id, Item.lista_id == lista_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item não encontrado")
    db.delete(item)
    db.commit()
    return {"ok": True}

@app.get("/api/listas/{lista_id}/resumo")
def resumo_lista(lista_id: int, db: Session = Depends(get_db)):
    lista = db.query(Lista).filter(Lista.id == lista_id).first()
    if not lista:
        raise HTTPException(status_code=404, detail="Lista não encontrada")
    total = db.query(func.count(Item.id)).filter(Item.lista_id == lista_id).scalar() or 0
    comprados = db.query(func.count(Item.id)).filter(Item.lista_id == lista_id, Item.comprado == True).scalar() or 0
    return {"id": lista.id, "itens": total, "comprados": comprados}


@app.post("/api/listas/{lista_id}/finalizar")
def finalizar_lista(
    lista_id: int,
    payload: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
):
    lista = db.query(Lista).filter(Lista.id == lista_id).first()
    if not lista:
        raise HTTPException(status_code=404, detail="Lista não encontrada")

    deve_finalizar = True
    if isinstance(payload, dict) and "finalizada" in payload:
        deve_finalizar = bool(payload.get("finalizada"))

    if deve_finalizar:
        if not lista.finalizada:
            lista.finalizada = True
            lista.finalizada_em = datetime.now(timezone.utc)
    else:
        lista.finalizada = False
        lista.finalizada_em = None

    db.commit()
    db.refresh(lista)
    return lista_to_dict(lista, db)


@app.get("/api/listas/{lista_id}/exportar")
def exportar_lista(lista_id: int, formato: str = "txt", db: Session = Depends(get_db)):
    lista = db.query(Lista).filter(Lista.id == lista_id).first()
    if not lista:
        raise HTTPException(status_code=404, detail="Lista não encontrada")
    itens = (
        db.query(Item)
        .filter(Item.lista_id == lista_id)
        .order_by(Item.ordem.asc(), Item.criado_em.asc())
        .all()
    )

    nome_base = f"lista-{lista_id}-{lista.nome.strip().lower().replace(' ', '-') or 'itens'}"

    if formato.lower() == "csv":
        linhas = ["nome,quantidade,comprado"]
        for item in itens:
            nome_csv = item.nome.replace('"', '""')
            linhas.append(
                f'"{nome_csv}",{item.quantidade},{1 if item.comprado else 0}'
            )
        conteudo = "\n".join(linhas)
        media_type = "text/csv"
        filename = f"{nome_base}.csv"
    else:
        linhas = [f"Lista: {lista.nome}", ""]
        for idx, item in enumerate(itens, start=1):
            marcador = "[x]" if item.comprado else "[ ]"
            linhas.append(f"{idx:02d}. {marcador} {item.nome} (x{item.quantidade})")
        conteudo = "\n".join(linhas)
        media_type = "text/plain"
        filename = f"{nome_base}.txt"

    headers = {"Content-Disposition": f'attachment; filename="{filename}"'}
    return PlainTextResponse(content=conteudo, media_type=media_type, headers=headers)

# Exemplos de payload / respostas (comentários)
# POST /api/listas { "nome": "Compras semanais" } -> 201 (aqui 200) { id: 1, nome: "Compras semanais", criado_em: "...", finalizada: false, finalizada_em: null, itens_count: 0 }
# PUT /api/listas/1 { "nome": "Lista atualizada" } -> { id: 1, nome: "Lista atualizada", ... }
# DELETE /api/listas/1 -> { ok: true }
# GET /api/listas -> [ { id: ..., nome: ..., criado_em: ..., ... } ]
# GET /api/listas/1/resumo -> { id: 1, itens: 0, comprados: 0 }
