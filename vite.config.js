// Configuração Vite com proxy para API FastAPI (comentários em português)
const path = require('node:path');

const frontendRoot = path.resolve(__dirname, 'frontend');

module.exports = {
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
    outDir: path.resolve(frontendRoot, 'dist'),
    rollupOptions: {
      input: {
        main: path.resolve(frontendRoot, 'index.html'),
        login: path.resolve(frontendRoot, 'login.html'),
      },
    },
  },
};
