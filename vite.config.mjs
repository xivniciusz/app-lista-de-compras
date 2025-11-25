// Configuração Vite com proxy para API FastAPI (comentários em português)
import { defineConfig } from 'vite';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const frontendRoot = resolve(__dirname, 'frontend');

export default defineConfig({
  root: frontendRoot,
  server: {
    host: true,
    port: 5175,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '/api'),
      },
    },
  },
  build: {
    outDir: resolve(frontendRoot, 'dist'),
    rollupOptions: {
      input: {
        main: resolve(frontendRoot, 'index.html'),
        login: resolve(frontendRoot, 'login.html'),
      },
    },
  },
});
