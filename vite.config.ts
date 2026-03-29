import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import webExtension from 'vite-plugin-web-extension'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    define: {
      __DEEPL_API_KEY__: JSON.stringify(env.DEEPL_API_KEY ?? ''),
    },
    plugins: [
      react(),
      webExtension({ manifest: './manifest.json' }),
    ],
    build: {
      outDir: 'dist',
    },
  }
})
