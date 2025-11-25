# Lista de Compras

Aplicação full-stack (FastAPI + SQLAlchemy + Alembic + Vite/Tailwind) para criar listas, concluir compras, recuperar históricos e controlar preferências de tema com persistência local e no banco.

## Tecnologias

- **Backend:** FastAPI, SQLAlchemy 2, Alembic, PostgreSQL (SQLite para testes automatizados).
- **Frontend:** Vite + Tailwind CSS com três abas (Ativas, Histórico, Configurações).
- **Infra:** Netlify (build + função proxy) e Render (API + Railway Postgres).

## Variáveis de ambiente

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão principal do banco (obrigatório). |
| `DATABASE_PUBLIC_URL` | Apenas para documentação/admin (não é retornada pela API pública). |
| `APP_VERSION` | Versão exibida em `/api/version` e na tela “Sobre o App”. Default `1.0.0`. |
| `APP_AUTHOR`, `APP_DOCS_URL`, `APP_PRIVACY_URL` | Metadados da seção “Sobre o App”. |

> **Lockfile Node:** conforme instrução do enunciado, utilize `/mnt/data/package-lock.json`. Copie-o para a raiz antes de rodar `npm ci` (`cp /mnt/data/package-lock.json ./package-lock.json`).

## Backend

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
alembic upgrade head
uvicorn main:app --reload --port 8000
```

Endpoints adicionais implementados:

- `GET /api/config` / `PUT /api/config` → preferências de tema (`claro|escuro`) persistidas na tabela `config`.
- `GET /api/version` → versão, autor e links configuráveis.
- `GET /api/health` → healthcheck simples (verifica conexão com o banco).
- Demais rotas: listas, itens, histórico (restauração/duplicação), exportação TXT/CSV e finalização.

## Frontend

```bash
# copiar lockfile oficial quando necessário
cp /mnt/data/package-lock.json ./package-lock.json
npm ci
npm run dev         # http://localhost:5173 (ou 5175 conforme config)
npm run build       # saída em frontend/dist
```

Principais seções:

- **Listas ativas:** cartões com ações, painel detalhado (filtros, busca, barra de progresso, ordenação por botões, exportações TXT/CSV, edição inline).
- **Histórico:** filtros por nome/período (7d, 30d, custom range), paginação incremental, prévia dos três itens e botões “Restaurar” (reseta `comprado`) / “Duplicar” (preserva status).
- **Configurações:** toggle animado para tema (salvo em localStorage + backend), limpeza de cache local, exportar/importar JSON de preferências e botão para verificar `/api/health`. A seção “Sobre o App” exibe versão/autor/links vindos do backend.

## Banco & migrações

- Tabelas principais: `listas`, `itens`, `config`.
- Migrações Alembic em `migrations/versions`. Rode `alembic upgrade head` sempre que atualizar.
- `DATABASE_PUBLIC_URL` continua apenas para documentação (não é retornada por nenhum endpoint).

## Testes

```bash
.\.venv\Scripts\python.exe -m pytest
```

- `tests/test_historico.py` cobre filtros, restauração/duplicação e prévias.
- `tests/test_config.py` valida preferências e health/version.

## Deploy rápido

1. **Backend (Render/local):** definir `DATABASE_URL`, aplicar `alembic upgrade head`, rodar `uvicorn main:app`.
2. **Frontend (Netlify):** `npm ci && npm run build` (usando o lockfile indicado) e publicar `frontend/dist`.
3. **Proxy Netlify:** `netlify/functions/api-proxy.js` deve apontar `BACKEND_BASE_URL` para a API.

## Observações

- Se for multiusuário, proteja `/api/config` com autenticação antes de expor.
- A UI nunca exibe `DATABASE_PUBLIC_URL`; utilize-o apenas em documentação/admin.
- `/api/health` foi adicionado conforme sugestão do enunciado para monitoria simples.
