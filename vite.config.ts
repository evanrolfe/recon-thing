import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Served from https://evanrolfe.github.io/recon-thing/
  base: '/recon-thing/',
  plugins: [react(), tailwindcss()],
})
