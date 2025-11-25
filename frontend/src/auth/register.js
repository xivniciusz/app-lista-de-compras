import { AuthAPI } from '../api.js';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function setMessage(element, message, type = 'error') {
  if (!element) return;
  element.textContent = message;
  if (!message) {
    element.classList.add('hidden');
    return;
  }
  element.classList.remove('hidden');
  element.classList.toggle('bg-emerald-50', type === 'success');
  element.classList.toggle('text-emerald-700', type === 'success');
  element.classList.toggle('border', true);
  element.classList.toggle('border-emerald-200', type === 'success');
  element.classList.toggle('bg-red-50', type !== 'success');
  element.classList.toggle('text-red-600', type !== 'success');
  element.classList.toggle('border-red-200', type !== 'success');
}

function setLoading(button, loading, labelDefault) {
  if (!button) return;
  const spinner = button.querySelector('[data-spinner]');
  const label = button.querySelector('[data-label]');
  button.disabled = loading;
  if (spinner) spinner.classList.toggle('hidden', !loading);
  if (label) label.textContent = loading ? 'Enviando...' : labelDefault;
}

export function setupRegisterForm({ onSuccess } = {}) {
  const form = document.getElementById('registerForm');
  const message = document.getElementById('registerMessage');
  const button = document.getElementById('btnRegister');
  if (!form || !button) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nome = form.registerNome?.value?.trim() ?? '';
    const email = form.registerEmail?.value?.trim() ?? '';
    const senha = form.registerSenha?.value ?? '';

    if (!nome) {
      setMessage(message, 'Informe seu nome completo.');
      return;
    }
    if (!emailRegex.test(email)) {
      setMessage(message, 'Digite um e-mail válido.');
      return;
    }
    if (!senha || senha.length < 6) {
      setMessage(message, 'A senha precisa ter pelo menos 6 caracteres.');
      return;
    }

    setMessage(message, '');
    setLoading(button, true, 'Criar conta');
    try {
      await AuthAPI.register({ nome, email, senha });
      setMessage(message, 'Conta criada! Faça login para continuar.', 'success');
      form.reset();
      if (typeof onSuccess === 'function') {
        onSuccess();
      }
    } catch (err) {
      setMessage(message, err.message || 'Não foi possível criar sua conta.');
    } finally {
      setLoading(button, false, 'Criar conta');
    }
  });
}
