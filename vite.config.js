import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  test: {
    environment: 'node',
  },
  plugins: [react()],
  server: {
    proxy: {
      '/plantscrnadb-api': {
        target: 'http://ibi.zju.edu.cn',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/plantscrnadb-api/, '/PlantscRNAdb_v4/api'),
        headers: {
          'Origin': 'http://ibi.zju.edu.cn',
          'Referer': 'http://ibi.zju.edu.cn/plantscrnadb/',
          'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        },
      },
    },
  },
})
