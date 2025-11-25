// Configuração Vite com proxy para API FastAPI (comentários em português)
import { defineConfig } from 'vite';

export default defineConfig({
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
});
