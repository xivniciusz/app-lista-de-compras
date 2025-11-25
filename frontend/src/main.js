import './index.css';
import './api.js';
import { ListasAPI, ItensAPI } from './api.js';

// Comentários em português explicando cada parte
const appEl = document.getElementById('app');

// Estado em memória para listas
let listas = [];
let listaSelecionadaParaRenomear = null;
let listaSelecionadaParaExcluir = null;
let listaAtivaId = null;

function formatarData(iso) {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
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
          <h3 class='font-semibold text-lg'>${l.nome}</h3>
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
      <div class='text-sm'>Itens: <span>${l.itens_count || 0}</span></div>
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
}

function mostrarStatus(msg) {
  const el = document.getElementById('statusMsg');
  if (!el) return;
  el.textContent = msg;
  setTimeout(() => { el.textContent = ''; }, 4000);
}

async function carregarListas() {
  try {
    listas = await ListasAPI.listar();
    renderizarListas();
  } catch (err) {
    mostrarStatus(err.message);
  }
}

async function carregarItensDaLista(listaId) {
  try {
    const itens = await ItensAPI.listar(listaId);
    renderizarDetalheLista(listaId, itens);
  } catch (err) {
    mostrarStatus(err.message);
  }
}

function renderizarDetalheLista(listaId, itens) {
  const detalhe = document.getElementById('detalheLista');
  detalhe.innerHTML = '';
  const lista = listas.find(l => l.id === listaId);
  if (!lista) return;
  detalhe.classList.remove('hidden');
  detalhe.innerHTML = `
    <div class='flex items-center justify-between'>
      <h2 class='text-xl font-bold'>Lista: ${lista.nome}</h2>
      <button id='fecharDetalhe' class='text-sm px-3 py-1 rounded border'>Fechar</button>
    </div>
    <form id='formItem' class='flex gap-2 flex-wrap'>
      <input id='inputItemNome' type='text' placeholder='Nome do item' class='flex-1 border rounded px-3 py-2 dark:bg-neutral-700' required />
      <input id='inputItemQtd' type='number' min='1' value='1' class='w-24 border rounded px-3 py-2 dark:bg-neutral-700' required />
      <button class='bg-verde-principal hover:bg-verde-claro active:bg-verde-escuro text-white px-4 py-2 rounded'>Adicionar Item</button>
    </form>
    <ul id='listaItens' class='divide-y border rounded bg-white dark:bg-neutral-800 mt-4'></ul>
  `;
  const ul = detalhe.querySelector('#listaItens');
  itens.forEach(i => {
    const li = document.createElement('li');
    li.className = 'flex items-center justify-between px-3 py-2';
    li.innerHTML = `
      <div class='flex flex-col'>
        <span class='font-medium ${i.comprado ? 'line-through text-neutral-400' : ''}'>${i.nome} (x${i.quantidade})</span>
        <span class='text-xs text-neutral-500'>ID: ${i.id}</span>
      </div>
      <div class='flex gap-2'>
        <button class='text-xs px-2 py-1 rounded border' data-toggle='${i.id}'>${i.comprado ? 'Desmarcar' : 'Comprar'}</button>
        <button class='text-xs px-2 py-1 rounded border text-red-600' data-del='${i.id}'>Excluir</button>
      </div>
    `;
    ul.appendChild(li);
  });

  detalhe.querySelector('#fecharDetalhe').addEventListener('click', () => {
    detalhe.classList.add('hidden');
    listaAtivaId = null;
  });

  detalhe.querySelector('#formItem').addEventListener('submit', async (e) => {
    e.preventDefault();
    const nomeEl = detalhe.querySelector('#inputItemNome');
    const qtdEl = detalhe.querySelector('#inputItemQtd');
    try {
      await ItensAPI.criar(listaId, nomeEl.value.trim(), Number(qtdEl.value));
      nomeEl.value = '';
      qtdEl.value = '1';
      await carregarListas();
      await carregarItensDaLista(listaId);
    } catch (err) {
      mostrarStatus(err.message);
    }
  });

  ul.addEventListener('click', async (e) => {
    const toggleBtn = e.target.closest('[data-toggle]');
    const delBtn = e.target.closest('[data-del]');
    if (toggleBtn) {
      const itemId = Number(toggleBtn.getAttribute('data-toggle'));
      const item = itens.find(i => i.id === itemId);
      try {
        await ItensAPI.atualizar(listaId, itemId, { comprado: !item.comprado });
        await carregarListas();
        await carregarItensDaLista(listaId);
      } catch (err) { mostrarStatus(err.message); }
    }
    if (delBtn) {
      const itemId = Number(delBtn.getAttribute('data-del'));
      try {
        await ItensAPI.excluir(listaId, itemId);
        await carregarListas();
        await carregarItensDaLista(listaId);
      } catch (err) { mostrarStatus(err.message); }
    }
  });
}

// Clique no card da lista para abrir detalhes
document.body.addEventListener('click', (e) => {
  const card = e.target.closest('[data-lista]');
  if (card) {
    listaAtivaId = Number(card.getAttribute('data-lista'));
    carregarItensDaLista(listaAtivaId);
  }
});

carregarListas();
inicializarEventos();
