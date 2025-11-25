from fastapi import FastAPI, HTTPException, Depends, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.orm import selectinload
from datetime import datetime, timezone, timedelta
import os
from dotenv import load_dotenv
from typing import Generator, Optional, Tuple
from models import Base, Lista, Item

# Carrega variáveis de ambiente (.env)
load_dotenv()

# Recupera URL do banco (DATABASE_URL) - DATABASE_PUBLIC_URL pode ser usada em documentação
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL não definida no ambiente")

# Configuração do SQLAlchemy
engine_kwargs = {"pool_pre_ping": True}
connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args["check_same_thread"] = False
engine = create_engine(DATABASE_URL, connect_args=connect_args, **engine_kwargs)
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
def lista_to_dict(l: Lista, db: Session = None, incluir_itens: bool = False):
    itens_count = 0
    itens_preview = []
    if db is not None:
        itens_count = db.query(func.count(Item.id)).filter(Item.lista_id == l.id).scalar()
        if incluir_itens:
            itens_preview = (
                db.query(Item)
                .filter(Item.lista_id == l.id)
                .order_by(Item.ordem.asc(), Item.criado_em.asc())
                .limit(3)
                .all()
            )
    return {
        "id": l.id,
        "nome": l.nome,
        "criado_em": l.criado_em.isoformat(),
        "finalizada": l.finalizada,
        "finalizada_em": l.finalizada_em.isoformat() if l.finalizada_em else None,
        "itens_count": itens_count,
        "preview_itens": [item_to_dict(i) for i in itens_preview] if incluir_itens else None,
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

def _gerar_nome_disponivel(db: Session, base: str, sufixo: str) -> str:
    nome_base = (base or "Lista").strip() or "Lista"
    existente = db.query(Lista).filter(Lista.nome == nome_base).first()
    if not existente:
        return nome_base
    contador = 2
    candidato = f"{nome_base} {sufixo}".strip()
    while db.query(Lista).filter(Lista.nome == candidato).first():
        candidato = f"{nome_base} {sufixo} {contador}".strip()
        contador += 1
    return candidato


def _clonar_lista(
    db: Session,
    lista: Lista,
    *,
    resetar_compra: bool,
    sufixo: str,
    nome_forcado: Optional[str] = None,
) -> Lista:
    nome_gerado = None
    if nome_forcado:
        nome_forcado = nome_forcado.strip()
        if not nome_forcado:
            raise HTTPException(status_code=400, detail="Nome informado é inválido")
        conflito = db.query(Lista).filter(Lista.nome == nome_forcado).first()
        nome_gerado = nome_forcado if not conflito else _gerar_nome_disponivel(db, nome_forcado, sufixo)
    else:
        nome_gerado = _gerar_nome_disponivel(db, lista.nome, sufixo)

    nova = Lista(nome=nome_gerado, finalizada=False, finalizada_em=None)
    db.add(nova)
    db.flush()

    itens_origem = (
        db.query(Item)
        .filter(Item.lista_id == lista.id)
        .order_by(Item.ordem.asc(), Item.criado_em.asc())
        .all()
    )
    for item in itens_origem:
        clone = Item(
            lista_id=nova.id,
            nome=item.nome,
            quantidade=item.quantidade,
            comprado=False if resetar_compra else item.comprado,
            ordem=item.ordem,
        )
        db.add(clone)
    return nova


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


def _aplicar_periodo(periodo: str, data_inicio: Optional[str], data_fim: Optional[str]) -> Tuple[Optional[datetime], Optional[datetime]]:
    agora = datetime.now(timezone.utc)
    inicio = fim = None
    periodo = (periodo or "30d").lower()
    if periodo == "7d":
        inicio = agora - timedelta(days=7)
    elif periodo == "30d" or periodo == "mes":
        inicio = agora - timedelta(days=30)
    elif periodo == "custom" and data_inicio and data_fim:
        try:
            inicio = datetime.fromisoformat(data_inicio)
            fim = datetime.fromisoformat(data_fim)
        except ValueError:
            raise HTTPException(status_code=400, detail="Datas inválidas no filtro")
    elif periodo == "custom":
        raise HTTPException(status_code=400, detail="Para período custom informe data_inicio e data_fim")

    if fim and inicio and fim < inicio:
        raise HTTPException(status_code=400, detail="data_fim deve ser maior que data_inicio")
    return inicio, fim


@app.get("/api/historico")
def listar_historico(
    busca: Optional[str] = Query(default=None, description="Filtro por nome"),
    periodo: str = Query(default="30d", description="7d|30d|custom"),
    data_inicio: Optional[str] = Query(default=None),
    data_fim: Optional[str] = Query(default=None),
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=9, ge=1, le=50),
    db: Session = Depends(get_db),
):
    query = db.query(Lista).filter(Lista.finalizada == True)
    if busca:
        like = f"%{busca.strip()}%"
        query = query.filter(Lista.nome.ilike(like))

    inicio, fim = _aplicar_periodo(periodo, data_inicio, data_fim)
    if inicio:
        query = query.filter(Lista.finalizada_em >= inicio)
    if fim:
        query = query.filter(Lista.finalizada_em <= fim)

    total = query.count()
    offset = (page - 1) * limit
    listas_page = (
        query.order_by(Lista.finalizada_em.desc().nullslast(), Lista.criado_em.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    ids = [l.id for l in listas_page]
    itens_map = {i: [] for i in ids}
    if ids:
        itens = (
            db.query(Item)
            .filter(Item.lista_id.in_(ids))
            .order_by(Item.lista_id.asc(), Item.ordem.asc(), Item.criado_em.asc())
            .all()
        )
        for item in itens:
            if len(itens_map[item.lista_id]) < 3:
                itens_map[item.lista_id].append(item_to_dict(item))

    data = []
    for lista in listas_page:
        info = lista_to_dict(lista, db)
        info["preview_itens"] = itens_map.get(lista.id, [])
        data.append(info)

    return {
        "data": data,
        "meta": {
            "total": total,
            "page": page,
            "limit": limit,
            "has_more": offset + len(listas_page) < total,
        },
    }


@app.post("/api/historico/restaurar/{lista_id}")
def restaurar_lista(
    lista_id: int,
    payload: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
):
    lista = (
        db.query(Lista)
        .options(selectinload(Lista.itens))
        .filter(Lista.id == lista_id, Lista.finalizada == True)
        .first()
    )
    if not lista:
        raise HTTPException(status_code=404, detail="Lista não encontrada no histórico")

    nome_custom = None
    if isinstance(payload, dict):
        nome_custom = payload.get("nome")

    try:
        nova = _clonar_lista(db, lista, resetar_compra=True, sufixo="(restaurada)", nome_forcado=nome_custom)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(nova)
    return lista_to_dict(nova, db)


@app.post("/api/historico/duplicar/{lista_id}")
def duplicar_lista(
    lista_id: int,
    payload: Optional[dict] = Body(default=None),
    db: Session = Depends(get_db),
):
    lista = (
        db.query(Lista)
        .options(selectinload(Lista.itens))
        .filter(Lista.id == lista_id, Lista.finalizada == True)
        .first()
    )
    if not lista:
        raise HTTPException(status_code=404, detail="Lista não encontrada no histórico")

    nome_custom = None
    if isinstance(payload, dict):
        nome_custom = payload.get("nome")

    try:
        nova = _clonar_lista(db, lista, resetar_compra=False, sufixo="(cópia)", nome_forcado=nome_custom)
        db.commit()
    except Exception:
        db.rollback()
        raise

    db.refresh(nova)
    return lista_to_dict(nova, db)

# Exemplos de payload / respostas (comentários)
# POST /api/listas { "nome": "Compras semanais" } -> 201 (aqui 200) { id: 1, nome: "Compras semanais", criado_em: "...", finalizada: false, finalizada_em: null, itens_count: 0 }
# PUT /api/listas/1 { "nome": "Lista atualizada" } -> { id: 1, nome: "Lista atualizada", ... }
# DELETE /api/listas/1 -> { ok: true }
# GET /api/listas -> [ { id: ..., nome: ..., criado_em: ..., ... } ]
# GET /api/listas/1/resumo -> { id: 1, itens: 0, comprados: 0 }
