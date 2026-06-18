import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

const crossOriginHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  plugins: [basicSsl()],
  server: {
    host: true,
    port: 5173,
    https: true,
    headers: crossOriginHeaders,
  },
  preview: {
    host: true,
    port: 4173,
    headers: crossOriginHeaders,
  },
  optimizeDeps: {
    exclude: ['@imgly/background-removal'],
  },
});