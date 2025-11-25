// api.js - funções utilitárias para chamadas à API (comentários em português)
const rawBase = (import.meta?.env?.VITE_API_BASE ?? '/api').trim();
const API_BASE = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;
const AUTH_TOKEN_KEY = 'authToken';
export function getApiBase() {
  // Exemplo de ajuste caso backend esteja em outra origem em produção
  return API_BASE;
}

export function getStoredToken() {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function saveAuthToken(token) {
  if (!token) {
    clearAuthToken();
    return;
  }
  localStorage.setItem(AUTH_TOKEN_KEY, token);
}

export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

const buildQueryString = (params = {}) => {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    search.append(key, value);
  });
  const qs = search.toString();
  return qs ? `?${qs}` : '';
};

// Função genérica para requisições
export async function apiFetch(path, { method = 'GET', body, headers = {}, auth = true } = {}) {
  const finalHeaders = { 'Content-Type': 'application/json', ...headers };
  if (auth) {
    const token = getStoredToken();
    if (token) {
      finalHeaders.Authorization = `Bearer ${token}`;
    }
  }
  const config = { method, headers: finalHeaders };
  if (body) config.body = JSON.stringify(body);
  const resp = await fetch(`${API_BASE}${path}`, config);
  if (!resp.ok) {
    // tenta ler mensagem de erro
    let msg = `Erro HTTP ${resp.status}`;
    try { const dataErr = await resp.json(); msg = dataErr.error || dataErr.detail || msg; } catch {}
    if (resp.status === 401 && auth) {
      clearAuthToken();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login.html') {
        window.location.href = '/login.html';
      }
    }
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

export const HistoricoAPI = {
  listar: (params) => apiFetch(`/historico${buildQueryString(params)}`),
  restaurar: (id, nome) => {
    const body = nome ? { nome } : undefined;
    return apiFetch(`/historico/restaurar/${id}`, { method: 'POST', body });
  },
  duplicar: (id, nome) => {
    const body = nome ? { nome } : undefined;
    return apiFetch(`/historico/duplicar/${id}`, { method: 'POST', body });
  },
};

export const ConfigAPI = {
  obter: () => apiFetch('/config'),
  atualizar: (tema) => apiFetch('/config', { method: 'PUT', body: { tema } }),
  versao: () => apiFetch('/version'),
  health: () => apiFetch('/health'),
};

export const AuthAPI = {
  register: (dados) => apiFetch('/auth/register', { method: 'POST', body: dados, auth: false }),
  login: (dados) => apiFetch('/auth/login', { method: 'POST', body: dados, auth: false }),
  me: () => apiFetch('/auth/me'),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
};
