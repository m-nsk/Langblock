import * as ort from 'onnxruntime-web/webgpu'
import { env, pipeline, cos_sim, type FeatureExtractionPipeline } from '@huggingface/transformers'

// Override the CDN wasmPaths that transformers.js sets at module init time with local extension URLs.
// This must happen before pipeline() is called, which triggers ensureWasmLoaded() internally.
// Chrome (non-Safari) uses the asyncify variant.
ort.env.wasm.wasmPaths = {
  mjs: chrome.runtime.getURL('transformers/ort-wasm-simd-threaded.asyncify.mjs'),
  wasm: chrome.runtime.getURL('transformers/ort-wasm-simd-threaded.asyncify.wasm'),
} as unknown as string

// Multi-threaded WASM requires SharedArrayBuffer (COOP/COEP headers) — unavailable in extensions.
ort.env.wasm.numThreads = 1

env.allowLocalModels = false
env.allowRemoteModels = true

let extractorPromise: Promise<FeatureExtractionPipeline> | null = null

function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (!extractorPromise) {
    extractorPromise = pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
      dtype: 'q8',
    }) as Promise<FeatureExtractionPipeline>
  }
  return extractorPromise
}

async function scoreSimilarity(textA: string, textB: string): Promise<number> {
  const extractor = await getExtractor()
  const output = await extractor([textA, textB], { pooling: 'mean', normalize: true })
  const data = output.data as Float32Array
  const embeddingA = data.slice(0, 384)
  const embeddingB = data.slice(384, 768)
  const similarity = cos_sim(embeddingA, embeddingB)
  return Math.round(Math.max(0, Math.min(100, similarity * 100)))
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.target !== 'offscreen') return

  if (message.type === 'score') {
    scoreSimilarity(message.textA, message.textB)
      .then((score) => sendResponse({ score }))
      .catch((err: unknown) => {
        console.error('[Langblock offscreen]', err)
        sendResponse({ error: String(err) })
      })
    return true
  }
})
