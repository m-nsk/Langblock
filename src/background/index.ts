declare const __DEEPL_API_KEY__: string

interface DeepLResponse {
  translations: Array<{ detected_source_language: string; text: string }>
}

interface TranslateMessage {
  type: 'TRANSLATE_BLOCKS'
  texts: string[]
  targetLang: string
}

const CACHE_PREFIX = 'tc:'

async function getCached(
  texts: string[],
  targetLang: string,
): Promise<Map<string, string>> {
  const keys = texts.map((t) => `${CACHE_PREFIX}${targetLang}:${t}`)
  const stored = await chrome.storage.local.get(keys)
  const result = new Map<string, string>()
  for (const text of texts) {
    const val = stored[`${CACHE_PREFIX}${targetLang}:${text}`]
    if (val !== undefined) result.set(text, val as string)
  }
  return result
}

async function setCached(
  pairs: Array<{ text: string; translation: string }>,
  targetLang: string,
): Promise<void> {
  const obj: Record<string, string> = {}
  for (const { text, translation } of pairs) {
    obj[`${CACHE_PREFIX}${targetLang}:${text}`] = translation
  }
  await chrome.storage.local.set(obj)
}

async function translateTexts(texts: string[], targetLang: string): Promise<string[]> {
  const cached = await getCached(texts, targetLang)

  // Deduplicate so identical sentences on the same page count once.
  const uniqueUncached = [...new Set(texts.filter((t) => !cached.has(t)))]

  if (uniqueUncached.length > 0) {
    const fresh: string[] = []

    for (let i = 0; i < uniqueUncached.length; i += 50) {
      const batch = uniqueUncached.slice(i, i + 50)
      const res = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
          Authorization: `DeepL-Auth-Key ${__DEEPL_API_KEY__}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: batch,
          target_lang: targetLang,
          tag_handling: 'html',
          split_sentences: 'nonewlines',
        }),
      })

      if (!res.ok) throw new Error(`DeepL ${res.status}: ${await res.text()}`)

      const data: DeepLResponse = await res.json()
      fresh.push(...data.translations.map((t) => t.text))
    }

    const newPairs = uniqueUncached.map((text, i) => ({ text, translation: fresh[i] }))
    await setCached(newPairs, targetLang)
    for (const { text, translation } of newPairs) cached.set(text, translation)

    const freshChars = uniqueUncached.reduce((sum, t) => sum + t.length, 0)
    console.log(
      `[Langblock] ${uniqueUncached.length} sentences translated (${freshChars} chars) · ${texts.length - uniqueUncached.length} from cache`,
    )
  }

  return texts.map((t) => cached.get(t)!)
}

chrome.runtime.onMessage.addListener(
  (msg: TranslateMessage, _sender, sendResponse) => {
    if (msg.type !== 'TRANSLATE_BLOCKS') return

    translateTexts(msg.texts, msg.targetLang)
      .then(sendResponse)
      .catch((err: unknown) => {
        console.error('[Langblock]', err)
        sendResponse(null)
      })

    return true
  },
)
