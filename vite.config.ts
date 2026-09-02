import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

export default defineConfig({
  // Served from a domain root by default. GitHub Pages serves from
  // /<repo-name>/, so builds for it set VITE_BASE=/quadrel-crm/ — see DEPLOY.md.
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  build: {
    rollupOptions: {
      output: {
        // Recharts + React are large and stable; splitting them keeps the app
        // chunk small and cacheable across deploys.
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          charts: ['recharts'],
        },
      },
    },
  },
  server: { port: 5173, open: false },
})
