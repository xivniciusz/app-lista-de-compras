from models import Usuario


def registrar(client, nome="Usuário Teste", email="user@example.com", senha="segredo123"):
    return client.post("/auth/register", json={"nome": nome, "email": email, "senha": senha})


def autenticar(client, email="user@example.com", senha="segredo123"):
    return client.post("/auth/login", json={"email": email, "senha": senha})


def test_register_cria_usuario(client, session_factory):
    resp = registrar(client)
    assert resp.status_code == 201
    dados = resp.json()
    assert dados["email"] == "user@example.com"
    verificar = session_factory()
    try:
        usuario = verificar.query(Usuario).filter(Usuario.email == "user@example.com").first()
    finally:
        verificar.close()
    assert usuario is not None
    assert usuario.senha_hash != "segredo123"


def test_register_rejeita_email_duplicado(client):
    primeiro = registrar(client)
    assert primeiro.status_code == 201
    segundo = registrar(client)
    assert segundo.status_code == 400


def test_login_retorna_token(client):
    registrar(client)
    resp = autenticar(client)
    assert resp.status_code == 200
    payload = resp.json()
    assert "access_token" in payload
    assert payload["token_type"] == "bearer"


def test_login_credenciais_invalidas(client):
    registrar(client)
    resp = autenticar(client, senha="errada")
    assert resp.status_code == 401


def test_me_retorna_dados_usuario(client):
    registrar(client)
    login = autenticar(client)
    token = login.json()["access_token"]
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    dados = resp.json()
    assert dados["email"] == "user@example.com"


def test_me_sem_token_retornar_401(client):
    resp = client.get("/auth/me")
    assert resp.status_code == 401


def test_logout_requer_token(client):
    registrar(client)
    token = autenticar(client).json()["access_token"]
    resp = client.post("/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    assert resp.json()["ok"] is True
