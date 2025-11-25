// api.js - funções utilitárias para chamadas à API (comentários em português)
const API_BASE = '/api'; // Em dev será proxy para backend; em produção pode apontar para domínio real
export function getApiBase() {
  // Exemplo de ajuste caso backend esteja em outra origem em produção
  return API_BASE;
}

// Função genérica para requisições
export async function apiFetch(path, { method = 'GET', body, headers = {} } = {}) {
  const config = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body) config.body = JSON.stringify(body);
  const resp = await fetch(`${API_BASE}${path}`, config);
  if (!resp.ok) {
    // tenta ler mensagem de erro
    let msg = `Erro HTTP ${resp.status}`;
    try { const dataErr = await resp.json(); msg = dataErr.error || msg; } catch {}
    throw new Error(msg);
  }
  // tentar parse json (204 não tem corpo)
  if (resp.status === 204) return null;
  return resp.json();
}

export const ListasAPI = {
  listar: () => apiFetch('/listas'),
  criar: (nome) => apiFetch('/listas', { method: 'POST', body: { nome } }),
  renomear: (id, nome) => apiFetch(`/listas/${id}`, { method: 'PUT', body: { nome } }),
  excluir: (id) => apiFetch(`/listas/${id}`, { method: 'DELETE' }),
  resumo: (id) => apiFetch(`/listas/${id}/resumo`),
};

export const ItensAPI = {
  listar: (listaId) => apiFetch(`/listas/${listaId}/itens`),
  criar: (listaId, nome, quantidade = 1) => apiFetch(`/listas/${listaId}/itens`, { method: 'POST', body: { nome, quantidade } }),
  atualizar: (listaId, itemId, dados) => apiFetch(`/listas/${listaId}/itens/${itemId}`, { method: 'PUT', body: dados }),
  excluir: (listaId, itemId) => apiFetch(`/listas/${listaId}/itens/${itemId}`, { method: 'DELETE' }),
};
