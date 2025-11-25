# Lista de Compras

Aplicação full-stack composta por **FastAPI + SQLAlchemy** (backend) e **Vite + Tailwind CSS** (frontend) para gerenciar listas de compras. O sistema permite criar, organizar e finalizar listas, além de consultar um **Histórico de Listas** com ações de restauração ou duplicação.

## 🚀 Principais recursos
- Criação, renomeação e exclusão de listas.
- Itens com quantidade, ordenação manual e controle de compra.
- Exportação (TXT/CSV) e finalização de listas com registro de `finalizada_em`.
- Tela detalhada “Itens da Lista” com filtros, busca e barra de progresso.
- **Tela “Histórico de Listas”** com busca por nome, filtro por período (7 dias, 30 dias ou faixa personalizada) e paginação incremental.
- Ações rápidas sobre listas arquivadas:
  - **Restaurar:** gera uma nova lista reaberta com itens reordenados e campos `comprado` resetados para `false`, abrindo automaticamente o painel de itens.
  - **Duplicar:** cria uma nova lista com status/itens idênticos à original (útil para reutilizar checklists).
- Pré-visualização dos três primeiros itens diretamente no cartão do histórico e animação com toast após ações.

## 🗂️ Endpoints relevantes

| Método | Caminho | Descrição |
|--------|--------|-----------|
| `GET` | `/api/listas` | Lista todas as listas (ativas e finalizadas) ordenadas por criação. |
| `POST` | `/api/listas` | Cria nova lista. |
| `PUT` | `/api/listas/{id}` | Renomeia lista. |
| `DELETE` | `/api/listas/{id}` | Remove lista e itens associados. |
| `GET` | `/api/listas/{id}/itens` | Retorna itens ordenados. |
| `POST` | `/api/listas/{id}/itens` | Adiciona item preservando ordem. |
| `PUT` | `/api/listas/{id}/itens/ordenar` | Recebe `{ "ordem": [ids...] }` para reordenar itens. |
| `POST` | `/api/listas/{id}/finalizar` | Marca/Desmarca lista como finalizada. |
| `GET` | `/api/listas/{id}/exportar?formato=txt|csv` | Exporta lista. |
| `GET` | `/api/historico` | Lista apenas listas finalizadas com suporte a `busca`, `periodo=7d|30d|custom`, `data_inicio`, `data_fim`, `page`, `limit`. Retorna preview dos itens e metadados de paginação. |
| `POST` | `/api/historico/restaurar/{id}` | Clona lista finalizada, zera `comprado`, remove flag de finalização e retorna novo ID. |
| `POST` | `/api/historico/duplicar/{id}` | Clona lista finalizada preservando status dos itens. |

### Conflitos de nome
Caso o nome escolhido para restauração/duplicação já exista, o backend gera automaticamente um sufixo (`(restaurada)`, `(cópia)` etc.) adicionando numeração incremental conforme necessário. Opcionalmente é possível passar `{ "nome": "Novo Nome" }` no corpo das ações de histórico.

## 🧪 Testes

Os testes utilizam `pytest` + `FastAPI TestClient` com um banco SQLite isolado. Para executá-los:

```bash
.\.venv\Scripts\python.exe -m pytest tests/test_historico.py
```

Eles cobrem:
- Filtros de histórico (nome/período) e limite de prévias.
- Clonagem/restauração garantindo ordens, campos e ausência de itens órfãos.
- Lógica de sufixos para nomes duplicados.

## 🏗️ Executando localmente

1. Configure as variáveis do backend em `.env` (ex.: `DATABASE_URL`).
2. Instale dependências Python:
	```bash
	pip install -r requirements.txt
	```
3. Inicie o backend:
	```bash
	uvicorn main:app --reload --port 8000
	```
4. Configure o frontend:
	```bash
	cd frontend
	npm install
	npm run dev
	```
5. Ajuste `VITE_API_BASE` conforme o endereço do backend (ex.: `http://localhost:8000/api`).

## 📦 Deploy

- **Frontend:** deployado via Netlify (build `npm run build`, publish `frontend/dist`) com função serverless (`netlify/functions/api-proxy.js`) que faz proxy para o backend.
- **Backend:** hospedado no Render (FastAPI + Railway Postgres). Lembre-se de atualizar as variáveis `BACKEND_BASE_URL` (Netlify) e `DATABASE_URL`.

## 📝 Observações adicionais

- A ordenação de itens utiliza índice crescente; o frontend manda a lista de IDs inteira no endpoint `/itens/ordenar`.
- Para filtros personalizados no histórico é necessário informar `data_inicio` e `data_fim` em formato ISO (`YYYY-MM-DD`).
- O botão “Carregar mais” da tela histórica utiliza paginação incremental; para grandes volumes considere ativar infinite scroll.
