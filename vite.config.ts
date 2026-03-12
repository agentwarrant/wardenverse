import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'esnext',
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  worker: {
    format: 'es',
  },
  server: {
    port: 3000,
    open: true,
    host: true, // Listen on all interfaces (for tailscale access)
  },
  preview: {
    port: 3000,
    host: true, // Listen on all interfaces (for tailscale access)
  },
});