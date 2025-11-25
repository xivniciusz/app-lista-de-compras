import './index.css';
import './api.js';
import { ListasAPI, ItensAPI, HistoricoAPI } from './api.js';

// Comentários em português explicando cada parte
const appEl = document.getElementById('app');

// Estado em memória para listas
let listas = [];
let listaSelecionadaParaRenomear = null;
let listaSelecionadaParaExcluir = null;
let listaAtivaId = null;
let itensDetalhe = [];
let filtroItens = 'todos';
let buscaItens = '';
let abaAtiva = 'ativas';
const historicoEstado = {
  itens: [],
  page: 1,
  hasMore: true,
  carregando: false,
  busca: '',
  periodo: '30d',
  dataInicio: '',
  dataFim: '',
};

function formatarData(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

function obterItensFiltrados() {
  return itensDetalhe.filter((item) => {
    if (filtroItens === 'pendentes' && item.comprado) return false;
    if (filtroItens === 'comprados' && !item.comprado) return false;
    if (buscaItens && !item.nome.toLowerCase().includes(buscaItens.toLowerCase())) return false;
    return true;
  });
}

async function moverItem(listaId, itemId, direction) {
  const currentIndex = itensDetalhe.findIndex((i) => i.id === itemId);
  if (currentIndex === -1) return;
  const targetIndex = currentIndex + direction;
  if (targetIndex < 0 || targetIndex >= itensDetalhe.length) return;

  const novaOrdem = [...itensDetalhe];
  const [item] = novaOrdem.splice(currentIndex, 1);
  novaOrdem.splice(targetIndex, 0, item);

  try {
    await ItensAPI.reordenar(listaId, novaOrdem.map((i) => i.id));
    await carregarItensDaLista(listaId, { preservarEstado: true });
    mostrarStatus('Ordem atualizada.');
  } catch (err) {
    mostrarStatus(err.message);
  }
}

// Renderiza os cards das listas
function renderizarListas() {
  const grid = document.getElementById('gridListas');
  grid.innerHTML = '';
  listas.forEach(l => {
    const card = document.createElement('div');
    card.className = 'rounded border p-4 bg-white dark:bg-neutral-800 shadow hover:shadow-md transition flex flex-col gap-2 cursor-pointer';
    card.setAttribute('data-lista', l.id);
    card.innerHTML = `
      <div class='flex justify-between items-start'>
        <div>
          <div class='flex items-center gap-2 flex-wrap'>
            <h3 class='font-semibold text-lg'>${l.nome}</h3>
            ${l.finalizada ? "<span class='text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200'>Finalizada</span>" : ''}
          </div>
          <p class='text-xs text-neutral-500 dark:text-neutral-400'>Criado: ${formatarData(l.criado_em)}</p>
        </div>
        <div class='relative'>
          <button class='text-sm px-2 py-1 rounded bg-neutral-200 dark:bg-neutral-700 hover:bg-neutral-300 dark:hover:bg-neutral-600' data-menu='${l.id}'>Ações ▾</button>
          <div class='hidden absolute right-0 mt-1 w-32 rounded border bg-white dark:bg-neutral-800 shadow text-sm flex-col' data-popup='${l.id}'>
            <button class='px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700' data-renomear='${l.id}'>Renomear</button>
            <button class='px-3 py-2 text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 text-red-600' data-excluir='${l.id}'>Excluir</button>
          </div>
        </div>
      </div>
      <div class='text-sm flex justify-between items-center'>
        <span>Itens: <strong>${l.itens_count || 0}</strong></span>
        ${l.finalizada && l.finalizada_em ? `<span class='text-[11px] text-neutral-400'>Concluída em ${formatarData(l.finalizada_em)}</span>` : ''}
      </div>
    `;
    grid.appendChild(card);
  });
}

// Mostra ou esconde popups de menu
function togglePopup(id) {
  document.querySelectorAll('[data-popup]').forEach(p => {
    if (p.getAttribute('data-popup') === id) {
      p.classList.toggle('hidden');
    } else {
      p.classList.add('hidden');
    }
  });
}

// Inicializa todos os handlers
function inicializarEventos() {
  const btnTema = document.getElementById('btnTema');
  const btnNova = document.getElementById('btnNovaLista');
  const modalCriar = document.getElementById('modalCriar');
  const formCriar = document.getElementById('formCriar');
  const inputNomeCriar = document.getElementById('inputNomeCriar');
  const modalRenomear = document.getElementById('modalRenomear');
  const formRenomear = document.getElementById('formRenomear');
  const inputNomeRenomear = document.getElementById('inputNomeRenomear');
  const modalExcluir = document.getElementById('modalExcluir');
  const btnConfirmarExcluir = document.getElementById('btnConfirmarExcluir');
  const tabButtons = document.querySelectorAll('.tab-btn');
  const historicoBusca = document.getElementById('historicoBusca');
  const historicoPeriodo = document.getElementById('historicoPeriodo');
  const historicoInicio = document.getElementById('historicoInicio');
  const historicoFim = document.getElementById('historicoFim');
  const btnMaisHistorico = document.getElementById('btnMaisHistorico');
  const gridHistorico = document.getElementById('gridHistorico');

  // Alternar tema claro/escuro
  btnTema.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    localStorage.setItem('temaEscuro', document.documentElement.classList.contains('dark') ? '1' : '0');
  });
  // Carregar preferência inicial
  if (localStorage.getItem('temaEscuro') === '1') {
    document.documentElement.classList.add('dark');
  }

  // Abrir modal criar
  btnNova.addEventListener('click', () => {
    modalCriar.classList.remove('hidden');
    inputNomeCriar.focus();
  });

  tabButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      alternarAba(btn.getAttribute('data-tab'));
    });
  });

  toggleCamposCustom();

  if (historicoBusca) {
    let buscaTimeout;
    historicoBusca.addEventListener('input', (e) => {
      clearTimeout(buscaTimeout);
      const valor = e.target.value;
      buscaTimeout = setTimeout(() => {
        historicoEstado.busca = valor;
        carregarHistorico({ reset: true });
      }, 300);
    });
  }

  if (historicoPeriodo) {
    historicoPeriodo.addEventListener('change', (e) => {
      historicoEstado.periodo = e.target.value;
      if (historicoEstado.periodo !== 'custom') {
        historicoEstado.dataInicio = '';
        historicoEstado.dataFim = '';
        if (historicoInicio) historicoInicio.value = '';
        if (historicoFim) historicoFim.value = '';
        carregarHistorico({ reset: true });
      }
      toggleCamposCustom();
    });
  }

  if (historicoInicio && historicoFim) {
    historicoInicio.addEventListener('change', (e) => {
      historicoEstado.dataInicio = e.target.value;
      if (historicoEstado.dataFim) carregarHistorico({ reset: true });
    });
    historicoFim.addEventListener('change', (e) => {
      historicoEstado.dataFim = e.target.value;
      if (historicoEstado.dataInicio) carregarHistorico({ reset: true });
    });
  }

  if (btnMaisHistorico) {
    btnMaisHistorico.addEventListener('click', () => carregarHistorico());
  }

  if (gridHistorico) {
    gridHistorico.addEventListener('click', async (e) => {
      const btn = e.target.closest('[data-h-action]');
      if (!btn) return;
      const acao = btn.getAttribute('data-h-action');
      const id = Number(btn.getAttribute('data-id'));
      if (!id) return;
      await executarAcaoHistorico(acao, id);
    });
  }

  // Fechar modais por botões com data-close
  document.body.addEventListener('click', (e) => {
    if (e.target.matches('[data-close]')) {
      e.target.closest('.fixed').classList.add('hidden');
    }
  });

  // Menu de ações (delegação)
  document.body.addEventListener('click', (e) => {
    const menuBtn = e.target.closest('[data-menu]');
    if (menuBtn) {
      togglePopup(menuBtn.getAttribute('data-menu'));
    }
    const renBtn = e.target.closest('[data-renomear]');
    if (renBtn) {
      listaSelecionadaParaRenomear = Number(renBtn.getAttribute('data-renomear'));
      const lista = listas.find(l => l.id === listaSelecionadaParaRenomear);
      inputNomeRenomear.value = lista?.nome || '';
      modalRenomear.classList.remove('hidden');
      inputNomeRenomear.focus();
    }
    const exBtn = e.target.closest('[data-excluir]');
    if (exBtn) {
      listaSelecionadaParaExcluir = Number(exBtn.getAttribute('data-excluir'));
      modalExcluir.classList.remove('hidden');
    }
  });

  // Submeter criação
  formCriar.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await ListasAPI.criar(inputNomeCriar.value.trim());
      inputNomeCriar.value = '';
      modalCriar.classList.add('hidden');
      await carregarListas();
    } catch (err) {
      mostrarStatus(err.message);
    }
  });

  // Submeter renomear
  formRenomear.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await ListasAPI.renomear(listaSelecionadaParaRenomear, inputNomeRenomear.value.trim());
      modalRenomear.classList.add('hidden');
      listaSelecionadaParaRenomear = null;
      await carregarListas();
    } catch (err) {
      mostrarStatus(err.message);
    }
  });

  // Confirmar excluir
  btnConfirmarExcluir.addEventListener('click', async () => {
    try {
      await ListasAPI.excluir(listaSelecionadaParaExcluir);
      modalExcluir.classList.add('hidden');
      listaSelecionadaParaExcluir = null;
      await carregarListas();
    } catch (err) {
      mostrarStatus(err.message);
    }
  });

  atualizarTabs();
}

function mostrarStatus(msg) {
  const el = document.getElementById('statusMsg');
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 4000);
}

function atualizarTabs() {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    const ativa = btn.getAttribute('data-tab') === abaAtiva;
    btn.classList.toggle('bg-verde-principal', ativa);
    btn.classList.toggle('text-white', ativa);
    btn.classList.toggle('border-transparent', ativa);
    btn.classList.toggle('border', !ativa);
  });
  const secaoAtivas = document.getElementById('secaoAtivas');
  const secaoHistorico = document.getElementById('secaoHistorico');
  if (secaoAtivas && secaoHistorico) {
    secaoAtivas.classList.toggle('hidden', abaAtiva !== 'ativas');
    secaoHistorico.classList.toggle('hidden', abaAtiva !== 'historico');
  }
}

function alternarAba(novaAba) {
  if (abaAtiva === novaAba) return;
  abaAtiva = novaAba;
  if (abaAtiva === 'historico') {
    const detalhe = document.getElementById('detalheLista');
    if (detalhe) detalhe.classList.add('hidden');
    listaAtivaId = null;
    itensDetalhe = [];
    carregarHistorico({ reset: true });
  }
  atualizarTabs();
}

function toggleCamposCustom() {
  const mostrar = historicoEstado.periodo === 'custom';
  document.querySelectorAll('[data-range]').forEach((label) => {
    label.classList.toggle('hidden', !mostrar);
  });
}

function validarPeriodoCustom() {
  if (historicoEstado.periodo !== 'custom') return true;
  if (!historicoEstado.dataInicio || !historicoEstado.dataFim) {
    mostrarStatus('Informe datas inicial e final para o filtro customizado.');
    return false;
  }
  return true;
}

async function carregarHistorico({ reset = false } = {}) {
  if (historicoEstado.carregando) return;
  if (reset) {
    historicoEstado.page = 1;
    historicoEstado.itens = [];
    historicoEstado.hasMore = true;
  }
  if (!historicoEstado.hasMore && !reset) return;
  if (!validarPeriodoCustom()) return;
  historicoEstado.carregando = true;
  renderizarHistorico();
  try {
    const params = {
      page: historicoEstado.page,
      limit: 9,
      periodo: historicoEstado.periodo,
      busca: historicoEstado.busca || undefined,
    };
    if (historicoEstado.periodo === 'custom') {
      params.data_inicio = historicoEstado.dataInicio;
      params.data_fim = historicoEstado.dataFim;
    }
    const resp = await HistoricoAPI.listar(params);
    if (reset) {
      historicoEstado.itens = [];
    }
    historicoEstado.itens = historicoEstado.itens.concat(resp.data || []);
    const meta = resp.meta || {};
    const paginaAtual = meta.page || historicoEstado.page;
    historicoEstado.hasMore = Boolean(meta.has_more);
    historicoEstado.page = historicoEstado.hasMore ? paginaAtual + 1 : paginaAtual;
  } catch (err) {
    mostrarStatus(err.message);
  } finally {
    historicoEstado.carregando = false;
    renderizarHistorico();
  }
}

function renderizarHistorico() {
  const grid = document.getElementById('gridHistorico');
  if (!grid) return;
  if (historicoEstado.itens.length === 0) {
    grid.innerHTML = historicoEstado.carregando
      ? "<p class='text-sm text-neutral-500'>Carregando histórico...</p>"
      : "<p class='text-sm text-neutral-500'>Nenhuma lista finalizada encontrada.</p>";
  } else {
    grid.innerHTML = historicoEstado.itens
      .map((h) => {
        const previewLista = Array.isArray(h.preview_itens) ? h.preview_itens : [];
        const preview = previewLista
          .map((item, idx) => `
            <li class='flex items-center gap-2'><span class='text-xs text-neutral-400'>${idx + 1}.</span> <span>${item.nome}</span></li>
          `)
          .join('');
        const restantes = Math.max(0, (h.itens_count || 0) - previewLista.length);
        const conteudoPreview = preview || "<li class='text-xs text-neutral-400'>Sem itens.</li>";
        const extra = restantes > 0 ? `<li class='text-xs text-neutral-400'>+${restantes} itens</li>` : '';
        return `
          <article class='p-4 border rounded bg-white dark:bg-neutral-900 shadow-sm flex flex-col gap-3' data-h-card='${h.id}'>
            <div class='flex items-start justify-between gap-3'>
              <div>
                <h3 class='font-semibold'>${h.nome}</h3>
                <p class='text-xs text-neutral-500'>Finalizada em ${h.finalizada_em ? formatarData(h.finalizada_em) : '—'}</p>
              </div>
              <span class='text-xs px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 border'>${h.itens_count || 0} itens</span>
            </div>
            <ul class='text-sm text-neutral-600 dark:text-neutral-300 space-y-1'>${conteudoPreview}${extra}</ul>
            <div class='flex flex-wrap gap-2 text-sm'>
              <button class='px-3 py-1 rounded border hover:bg-neutral-100 dark:hover:bg-neutral-800' data-h-action='restaurar' data-id='${h.id}'>Restaurar</button>
              <button class='px-3 py-1 rounded border hover:bg-neutral-100 dark:hover:bg-neutral-800' data-h-action='duplicar' data-id='${h.id}'>Duplicar</button>
            </div>
          </article>
        `;
      })
      .join('');
  }

  const btnMais = document.getElementById('btnMaisHistorico');
  if (btnMais) {
    btnMais.classList.toggle('hidden', !historicoEstado.hasMore);
    btnMais.disabled = historicoEstado.carregando || !historicoEstado.hasMore;
    btnMais.textContent = historicoEstado.carregando ? 'Carregando...' : 'Carregar mais';
  }
}

async function executarAcaoHistorico(acao, id) {
  const card = document.querySelector(`[data-h-card='${id}']`);
  if (card) card.classList.add('animate-pulse');
  try {
    const fn = acao === 'duplicar' ? HistoricoAPI.duplicar : HistoricoAPI.restaurar;
    const novaLista = await fn(id);
    mostrarStatus(acao === 'duplicar' ? 'Lista duplicada!' : 'Lista restaurada!');
    await carregarListas();
    if (acao === 'restaurar' && novaLista?.id) {
      alternarAba('ativas');
      listaAtivaId = novaLista.id;
      await carregarItensDaLista(novaLista.id, { preservarEstado: false });
    }
  } catch (err) {
    mostrarStatus(err.message);
  } finally {
    if (card) card.classList.remove('animate-pulse');
  }
}

async function carregarListas() {
  try {
    listas = await ListasAPI.listar();
    renderizarListas();
    if (listaAtivaId) {
      const listaExiste = listas.find((l) => l.id === listaAtivaId);
      if (listaExiste) {
        renderizarDetalheLista(listaAtivaId);
      } else {
        document.getElementById('detalheLista').classList.add('hidden');
        listaAtivaId = null;
        itensDetalhe = [];
      }
    }
  } catch (err) {
    mostrarStatus(err.message);
  }
}

async function carregarItensDaLista(listaId, { preservarEstado = true } = {}) {
  try {
    const itens = await ItensAPI.listar(listaId);
    itensDetalhe = itens;
    if (!preservarEstado) {
      filtroItens = 'todos';
      buscaItens = '';
    }
    renderizarDetalheLista(listaId);
  } catch (err) {
    mostrarStatus(err.message);
  }
}

function renderizarDetalheLista(listaId) {
  const detalhe = document.getElementById('detalheLista');
  detalhe.innerHTML = '';
  const lista = listas.find((l) => l.id === listaId);
  if (!lista) return;

  const total = itensDetalhe.length;
  const comprados = itensDetalhe.filter((i) => i.comprado).length;
  const pendentes = total - comprados;
  const percent = total === 0 ? 0 : Math.round((comprados / total) * 100);
  const itensExibidos = obterItensFiltrados();

  const filtros = [
    { id: 'todos', label: 'Todos' },
    { id: 'pendentes', label: 'Pendentes' },
    { id: 'comprados', label: 'Comprados' },
  ];

  const itensHtml = itensExibidos.length
    ? itensExibidos
        .map((i, idx) => `
          <li class='px-3 py-3 flex flex-col gap-2 border-b last:border-b-0' data-item='${i.id}'>
            <div class='flex items-start justify-between gap-3'>
              <div>
                <p class='font-semibold ${i.comprado ? 'line-through text-neutral-400' : ''}'>${i.nome}</p>
                <p class='text-xs text-neutral-500'>Qtd: ${i.quantidade} • Ordem ${i.ordem}</p>
              </div>
              <div class='flex flex-wrap gap-2 text-xs'>
                <button class='px-2 py-1 border rounded' data-move='up' ${idx === 0 ? 'disabled' : ''}>↑</button>
                <button class='px-2 py-1 border rounded' data-move='down' ${idx === itensExibidos.length - 1 ? 'disabled' : ''}>↓</button>
                <button class='px-2 py-1 border rounded' data-edit='${i.id}'>Editar</button>
                <button class='px-2 py-1 border rounded' data-toggle='${i.id}'>${i.comprado ? 'Desmarcar' : 'Comprar'}</button>
                <button class='px-2 py-1 border rounded text-red-600' data-del='${i.id}'>Excluir</button>
              </div>
            </div>
            <div class='hidden border rounded px-3 py-3 bg-neutral-50 dark:bg-neutral-900' data-editor='${i.id}'>
              <form data-edit-form='${i.id}' class='flex flex-wrap gap-2 items-end'>
                <label class='flex-1 text-xs text-neutral-500'>
                  Nome
                  <input type='text' class='w-full border rounded px-2 py-1' value='${i.nome}' required />
                </label>
                <label class='w-24 text-xs text-neutral-500'>
                  Quantidade
                  <input type='number' min='1' class='w-full border rounded px-2 py-1' value='${i.quantidade}' required />
                </label>
                <div class='flex gap-2 ml-auto'>
                  <button type='button' class='px-3 py-1 border rounded' data-edit-cancel='${i.id}'>Cancelar</button>
                  <button class='px-3 py-1 bg-verde-principal text-white rounded'>Salvar</button>
                </div>
              </form>
            </div>
          </li>
        `)
        .join('')
    : "<li class='px-4 py-6 text-center text-sm text-neutral-500'>Nenhum item encontrado.</li>";

  detalhe.classList.remove('hidden');
  detalhe.innerHTML = `
    <section class='bg-white dark:bg-neutral-900 border rounded-lg p-4 space-y-4 shadow'>
      <div class='flex flex-col gap-2 md:flex-row md:items-center md:justify-between'>
        <div>
          <div class='flex items-center gap-2 flex-wrap'>
            <h2 class='text-xl font-bold'>${lista.nome}</h2>
            ${lista.finalizada ? "<span class='text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200'>Finalizada</span>" : ''}
          </div>
          <p class='text-xs text-neutral-500'>Criada em ${formatarData(lista.criado_em)}</p>
        </div>
        <div class='flex flex-wrap gap-2'>
          <button id='fecharDetalhe' class='px-3 py-2 border rounded'>Fechar</button>
          <button id='btnToggleFinalizar' class='px-3 py-2 rounded ${lista.finalizada ? 'bg-neutral-200 text-neutral-800' : 'bg-verde-principal text-white'}'>${lista.finalizada ? 'Reabrir lista' : 'Finalizar lista'}</button>
          <button class='px-3 py-2 border rounded' data-export='txt'>Exportar TXT</button>
          <button class='px-3 py-2 border rounded' data-export='csv'>Exportar CSV</button>
        </div>
      </div>

      <div>
        <div class='flex justify-between text-sm text-neutral-500 mb-1'>
          <span>${pendentes} pendentes</span>
          <span>${percent}% comprado</span>
        </div>
        <div class='h-2 bg-neutral-200 rounded-full overflow-hidden'>
          <div class='h-full bg-verde-principal transition-all' style='width:${percent}%;'></div>
        </div>
      </div>

      <div class='flex flex-wrap gap-2 items-center'>
        ${filtros
          .map(
            (f) => `
              <button class='px-3 py-1 text-sm rounded border ${filtroItens === f.id ? 'bg-verde-principal text-white border-verde-principal' : ''}' data-filter='${f.id}'>${f.label}</button>
            `,
          )
          .join('')}
        <input id='inputBuscaItens' type='search' placeholder='Buscar item...' value='${buscaItens}' class='flex-1 min-w-[160px] border rounded px-3 py-2' />
      </div>

      <form id='formItem' class='flex gap-2 flex-wrap'>
        <input id='inputItemNome' type='text' placeholder='Nome do item' class='flex-1 border rounded px-3 py-2 dark:bg-neutral-700' required />
        <input id='inputItemQtd' type='number' min='1' value='1' class='w-24 border rounded px-3 py-2 dark:bg-neutral-700' required />
        <button class='bg-verde-principal hover:bg-verde-claro active:bg-verde-escuro text-white px-4 py-2 rounded'>Adicionar Item</button>
      </form>

      <ul id='listaItens' class='border rounded divide-y bg-white dark:bg-neutral-800'>${itensHtml}</ul>
    </section>
  `;

  const listaItensEl = detalhe.querySelector('#listaItens');

  detalhe.querySelector('#fecharDetalhe').addEventListener('click', () => {
    detalhe.classList.add('hidden');
    listaAtivaId = null;
    itensDetalhe = [];
  });

  const formItem = detalhe.querySelector('#formItem');
  formItem.addEventListener('submit', async (e) => {
    e.preventDefault();
    const nomeEl = detalhe.querySelector('#inputItemNome');
    const qtdEl = detalhe.querySelector('#inputItemQtd');
    try {
      await ItensAPI.criar(listaId, nomeEl.value.trim(), Number(qtdEl.value));
      nomeEl.value = '';
      qtdEl.value = '1';
      await carregarListas();
      await carregarItensDaLista(listaId, { preservarEstado: true });
      mostrarStatus('Item adicionado com sucesso!');
    } catch (err) {
      mostrarStatus(err.message);
    }
  });

  detalhe.querySelectorAll('[data-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      filtroItens = btn.getAttribute('data-filter');
      renderizarDetalheLista(listaId);
    });
  });

  const inputBusca = detalhe.querySelector('#inputBuscaItens');
  inputBusca.addEventListener('input', (e) => {
    buscaItens = e.target.value;
    renderizarDetalheLista(listaId);
  });

  detalhe.querySelectorAll('[data-export]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      try {
        const formato = btn.getAttribute('data-export');
        const { blob, filename } = await ListasAPI.exportar(listaId, formato);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        mostrarStatus(`Exportado (${formato.toUpperCase()})`);
      } catch (err) {
        mostrarStatus(err.message);
      }
    });
  });

  detalhe.querySelector('#btnToggleFinalizar').addEventListener('click', async () => {
    try {
      await ListasAPI.finalizar(listaId, !lista.finalizada);
      await carregarListas();
      await carregarItensDaLista(listaId, { preservarEstado: true });
      mostrarStatus(!lista.finalizada ? 'Lista finalizada!' : 'Lista reaberta.');
    } catch (err) {
      mostrarStatus(err.message);
    }
  });

  listaItensEl.addEventListener('click', async (e) => {
    const toggleBtn = e.target.closest('[data-toggle]');
    const delBtn = e.target.closest('[data-del]');
    const moveBtn = e.target.closest('[data-move]');
    const editBtn = e.target.closest('[data-edit]');
    const cancelEditBtn = e.target.closest('[data-edit-cancel]');

    if (toggleBtn) {
      const itemId = Number(toggleBtn.getAttribute('data-toggle'));
      const item = itensDetalhe.find((i) => i.id === itemId);
      if (!item) return;
      try {
        await ItensAPI.atualizar(listaId, itemId, { comprado: !item.comprado });
        await carregarListas();
        await carregarItensDaLista(listaId, { preservarEstado: true });
      } catch (err) { mostrarStatus(err.message); }
    }

    if (delBtn) {
      const itemId = Number(delBtn.getAttribute('data-del'));
      try {
        await ItensAPI.excluir(listaId, itemId);
        await carregarListas();
        await carregarItensDaLista(listaId, { preservarEstado: true });
        mostrarStatus('Item excluído.');
      } catch (err) { mostrarStatus(err.message); }
    }

    if (moveBtn) {
      const direction = moveBtn.getAttribute('data-move') === 'up' ? -1 : 1;
      await moverItem(listaId, Number(moveBtn.closest('li').getAttribute('data-item')), direction);
    }

    if (editBtn) {
      const id = editBtn.getAttribute('data-edit');
      const panel = detalhe.querySelector(`[data-editor='${id}']`);
      if (panel) panel.classList.toggle('hidden');
    }

    if (cancelEditBtn) {
      const id = cancelEditBtn.getAttribute('data-edit-cancel');
      const panel = detalhe.querySelector(`[data-editor='${id}']`);
      if (panel) panel.classList.add('hidden');
    }
  });

  listaItensEl.addEventListener('submit', async (e) => {
    const form = e.target.closest('[data-edit-form]');
    if (!form) return;
    e.preventDefault();
    const itemId = Number(form.getAttribute('data-edit-form'));
    const inputs = form.querySelectorAll('input');
    const nome = inputs[0].value.trim();
    const qtd = Number(inputs[1].value);
    if (!nome || qtd < 1) return;
    try {
      await ItensAPI.atualizar(listaId, itemId, { nome, quantidade: qtd });
      await carregarListas();
      await carregarItensDaLista(listaId, { preservarEstado: true });
      mostrarStatus('Item atualizado.');
    } catch (err) {
      mostrarStatus(err.message);
    }
  });
}

// Clique no card da lista para abrir detalhes
document.body.addEventListener('click', (e) => {
  const card = e.target.closest('[data-lista]');
  if (card) {
    listaAtivaId = Number(card.getAttribute('data-lista'));
    carregarItensDaLista(listaAtivaId, { preservarEstado: false });
  }
});

carregarListas();
inicializarEventos();
