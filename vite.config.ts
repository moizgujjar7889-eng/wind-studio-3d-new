import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';

// https://vitejs.dev/config/
// Set base to your GitHub repo name if deploying to username.github.io/repo-name
// Example: base: '/wind-studio-3d/'
// For user/org site (username.github.io) use base: '/'
export default defineConfig({
  base: process.env.VITE_BASE || './',
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
});
