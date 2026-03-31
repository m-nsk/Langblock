import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import webExtension from 'vite-plugin-web-extension'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    define: {
      __DEEPL_API_KEY__: JSON.stringify(env.DEEPL_API_KEY ?? ''),
    },
    plugins: [
      react(),
      webExtension({
        manifest: './manifest.json',
        additionalInputs: ['src/offscreen/offscreen.html'],
      }),
      viteStaticCopy({
        targets: [
          // Chrome (non-Safari) uses the asyncify WASM variant for onnxruntime-web.
          // rename: { stripBase: true } strips the node_modules/.../ prefix so files
          // land directly in dist/transformers/ rather than a deeply nested path.
          {
            src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.mjs',
            dest: 'transformers',
            rename: { stripBase: true },
          },
          {
            src: 'node_modules/onnxruntime-web/dist/ort-wasm-simd-threaded.asyncify.wasm',
            dest: 'transformers',
            rename: { stripBase: true },
          },
        ],
      }),
    ],
    // Prevent esbuild from choking on WASM imports during pre-bundling (dev mode).
    optimizeDeps: {
      exclude: ['@huggingface/transformers', 'onnxruntime-web'],
    },
    assetsInclude: ['**/*.onnx', '**/*.wasm'],
    build: {
      outDir: 'dist',
    },
  }
})
