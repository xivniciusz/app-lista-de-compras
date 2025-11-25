from datetime import datetime

from main import APP_AUTHOR, APP_DOCS_URL, APP_PRIVACY_URL, APP_VERSION
from models import Configuracao


def test_config_retornada_com_padrao_e_cria_registro(client, session_factory):
    resp = client.get("/api/config")
    assert resp.status_code == 200
    payload = resp.json()
    assert payload == {"tema": "claro"}

    verificar = session_factory()
    try:
        registros = verificar.query(Configuracao).all()
    finally:
        verificar.close()
    assert len(registros) == 1
    assert registros[0].tema == "claro"


def test_config_atualiza_tema_e_persiste(client):
    resp = client.put("/api/config", json={"tema": "escuro"})
    assert resp.status_code == 200
    assert resp.json()["tema"] == "escuro"

    conf = client.get("/api/config")
    assert conf.status_code == 200
    assert conf.json()["tema"] == "escuro"


def test_config_rejeita_tema_invalido(client):
    resp = client.put("/api/config", json={"tema": "azul"})
    assert resp.status_code == 400
    assert "Tema inválido" in resp.json()["detail"]


def test_version_endpoint_reflete_variaveis(client):
    resp = client.get("/api/version")
    assert resp.status_code == 200
    data = resp.json()
    assert data["version"] == APP_VERSION
    assert data["author"] == APP_AUTHOR
    assert data["docs"] == APP_DOCS_URL
    assert data["privacy"] == APP_PRIVACY_URL


def test_health_endpoint_retorna_status_ok(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["database"] is True
    datetime.fromisoformat(data["timestamp"])
