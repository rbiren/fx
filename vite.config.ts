import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api/fred': {
        target: 'https://api.stlouisfed.org',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/fred/, '/fred'),
      },
      '/api/ecb': {
        target: 'https://data-api.ecb.europa.eu',
        changeOrigin: true,
        rewrite: (path) => {
          const url = new URL(path, 'http://localhost');
          const params = url.searchParams;
          return `/service/data/EXR/D.USD.EUR.SP00.A?startPeriod=${params.get('startPeriod')}&endPeriod=${params.get('endPeriod')}&format=${params.get('format')}`;
        },
      },
    },
  },
})
