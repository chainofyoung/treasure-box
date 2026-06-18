import { defineConfig } from 'vite';

const crossOriginHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp',
};

export default defineConfig({
  server: {
    host: true,
    port: 5173,
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