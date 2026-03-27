import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      // Використовуємо простіший збіг за префіксом
      '/s3': {
        target: 's3-railway-demo-production-26d6.up.railway.app',
        changeOrigin: true,
        secure: false,
      }
    }
  }
})