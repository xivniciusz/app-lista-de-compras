// api.js - funções utilitárias para chamadas à API (comentários em português)
const rawBase = (import.meta?.env?.VITE_API_BASE ?? '/api').trim();
const API_BASE = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
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
  finalizar: (id, finalizada = true) => apiFetch(`/listas/${id}/finalizar`, { method: 'POST', body: { finalizada } }),
  exportar: async (id, formato = 'txt') => {
    const resp = await fetch(`${API_BASE}/listas/${id}/exportar?formato=${encodeURIComponent(formato)}`);
    if (!resp.ok) {
      let msg = `Erro HTTP ${resp.status}`;
      try {
        const dataErr = await resp.json();
        msg = dataErr.error || msg;
      } catch {}
      throw new Error(msg);
    }
    const blob = await resp.blob();
    const header = resp.headers.get('Content-Disposition') || '';
    const match = header.match(/filename="?([^";]+)"?/i);
    const filename = match ? match[1] : `lista-${id}.${formato}`;
    return { blob, filename };
  },
};

export const ItensAPI = {
  listar: (listaId) => apiFetch(`/listas/${listaId}/itens`),
  criar: (listaId, nome, quantidade = 1) => apiFetch(`/listas/${listaId}/itens`, { method: 'POST', body: { nome, quantidade } }),
  atualizar: (listaId, itemId, dados) => apiFetch(`/listas/${listaId}/itens/${itemId}`, { method: 'PUT', body: dados }),
  excluir: (listaId, itemId) => apiFetch(`/listas/${listaId}/itens/${itemId}`, { method: 'DELETE' }),
  reordenar: (listaId, ids) => apiFetch(`/listas/${listaId}/itens/ordenar`, { method: 'PUT', body: { ordem: ids } }),
};
