import '../index.css';
import { AuthAPI, saveAuthToken, clearAuthToken, getStoredToken } from '../api.js';
import { setupRegisterForm } from './register.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function aplicarTemaSalvo() {
  try {
    const legado = localStorage.getItem('temaEscuro');
    if (legado !== null) {
      const tema = legado === '1' ? 'escuro' : 'claro';
      localStorage.setItem('appConfig', JSON.stringify({ tema }));
      localStorage.removeItem('temaEscuro');
    }
    const bruto = localStorage.getItem('appConfig');
    if (!bruto) {
      document.documentElement.classList.remove('dark');
      return;
    }
    const cfg = JSON.parse(bruto);
    document.documentElement.classList.toggle('dark', cfg?.tema === 'escuro');
  } catch {
    document.documentElement.classList.remove('dark');
  }
}

function setLoading(button, loading, labelDefault, loadingLabel = 'Carregando...') {
  if (!button) return;
  const spinner = button.querySelector('[data-spinner]');
  const label = button.querySelector('[data-label]');
  button.disabled = loading;
  if (spinner) spinner.classList.toggle('hidden', !loading);
  if (label) label.textContent = loading ? loadingLabel : labelDefault;
}

function setMessage(box, message, type = 'error') {
  if (!box) return;
  if (!message) {
    box.classList.add('hidden');
    box.textContent = '';
    return;
  }
  box.classList.remove('hidden');
  box.textContent = message;
  box.className = `text-sm rounded-lg px-3 py-2 ${
    type === 'success'
      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      : 'bg-red-50 text-red-600 border border-red-200'
  }`;
}

function toggleMode(mode) {
  const wrapper = document.getElementById('authWrapper');
  const pill = wrapper?.querySelector('.toggle-pill');
  if (!wrapper) return;
  const isRegister = mode === 'register';
  wrapper.classList.toggle('mode-register', isRegister);
  if (pill) {
    pill.textContent = isRegister ? 'Cadastro' : 'Login';
  }
}

function setupModeButtons() {
  document.querySelectorAll('[data-action="show-login"]').forEach((btn) => {
    btn.addEventListener('click', () => toggleMode('login'));
  });
  document.querySelectorAll('[data-action="show-register"]').forEach((btn) => {
    btn.addEventListener('click', () => toggleMode('register'));
  });
}

function setupPasswordToggles() {
  document.querySelectorAll('[data-toggle-password]').forEach((btn) => {
    const targetId = btn.getAttribute('data-toggle-password');
    const input = document.getElementById(targetId);
    if (!input) return;
    btn.addEventListener('click', () => {
      if (input.type === 'password') {
        input.type = 'text';
        btn.textContent = 'Ocultar';
      } else {
        input.type = 'password';
        btn.textContent = 'Mostrar';
      }
    });
  });
}

function setupLoginForm() {
  const form = document.getElementById('loginForm');
  const button = document.getElementById('btnLogin');
  const message = document.getElementById('loginMessage');
  if (!form || !button) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const email = form.loginEmail?.value?.trim() ?? '';
    const senha = form.loginSenha?.value ?? '';
    if (!emailRegex.test(email)) {
      setMessage(message, 'Digite um e-mail válido.');
      return;
    }
    if (!senha) {
      setMessage(message, 'Informe sua senha.');
      return;
    }
    setMessage(message, '');
    setLoading(button, true, 'Entrar', 'Entrando...');
    try {
      const resp = await AuthAPI.login({ email, senha });
      saveAuthToken(resp.access_token);
      window.location.href = '/';
    } catch (err) {
      setMessage(message, err.message || 'Não foi possível entrar.');
    } finally {
      setLoading(button, false, 'Entrar');
    }
  });
}

async function checarSessaoExistente() {
  const token = getStoredToken();
  if (!token) return;
  try {
    await AuthAPI.me();
    window.location.href = '/';
  } catch {
    clearAuthToken();
  }
}

function initAuthPage() {
  aplicarTemaSalvo();
  setupModeButtons();
  setupPasswordToggles();
  setupLoginForm();
  setupRegisterForm({ onSuccess: () => toggleMode('login') });
  checarSessaoExistente();
}

initAuthPage();
