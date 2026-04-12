import {
  DEFAULT_POINTS_STATE,
  calculateAwardedPoints,
  normalizePointsState,
  type AwardPointsMessage,
  type AwardPointsResponse,
  type GetPointsStateMessage,
  type PointsState,
  type SetPointsOverlayMessage,
} from '../shared/points'

declare const __DEEPL_API_KEY__: string

interface DeepLResponse {
  translations: Array<{ detected_source_language: string; text: string }>
}

interface DeepLUsage {
  character_count: number
  character_limit: number
}

async function checkUsage(charsNeeded: number): Promise<void> {
  const res = await fetch('https://api-free.deepl.com/v2/usage', {
    headers: { Authorization: `DeepL-Auth-Key ${__DEEPL_API_KEY__}` },
  })
  if (!res.ok) throw new Error(`DeepL usage check failed: ${res.status}`)
  const { character_count, character_limit }: DeepLUsage = await res.json()
  const remaining = character_limit - character_count
  console.log(`[Langblock] usage: ${character_count.toLocaleString()} / ${character_limit.toLocaleString()} (${remaining.toLocaleString()} remaining)`)
  if (charsNeeded > remaining) {
    throw new Error(
      `[Langblock] Halted: ${charsNeeded} chars needed but only ${remaining} remaining (${character_count}/${character_limit})`,
    )
  }
}

interface TranslateMessage {
  type: 'TRANSLATE_BLOCKS'
  texts: string[]
  targetLang: string
}

const CACHE_PREFIX = 'tc2:'

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
    const charsNeeded = uniqueUncached.reduce((sum, t) => sum + t.length, 0)
    await checkUsage(charsNeeded)

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

async function ensureOffscreen(): Promise<void> {
  if (await chrome.offscreen.hasDocument()) return
  await chrome.offscreen.createDocument({
    url: chrome.runtime.getURL('src/offscreen/offscreen.html'),
    reasons: [chrome.offscreen.Reason.WORKERS],
    justification: 'ML model inference with transformers.js',
  })
}

chrome.runtime.onInstalled.addListener(() => {
  ensureOffscreen().catch(() => {})
})

chrome.runtime.onStartup.addListener(() => {
  ensureOffscreen().catch(() => {})
})

interface ScoreMessage {
  type: 'SCORE_SIMILARITY'
  textA: string
  textB: string
}

type BackgroundMessage =
  | TranslateMessage
  | ScoreMessage
  | GetPointsStateMessage
  | SetPointsOverlayMessage
  | AwardPointsMessage

async function getPointsState(): Promise<PointsState> {
  const stored = await chrome.storage.sync.get(['pointsTotal', 'showPointsOverlay', 'streakDays', 'lastActiveDate'])
  return normalizePointsState(stored)
}

async function setPointsOverlay(show: boolean): Promise<PointsState> {
  const current = await getPointsState()
  const next = { ...current, showPointsOverlay: show }
  await chrome.storage.sync.set(next)
  return next
}

let awardPointsQueue = Promise.resolve<AwardPointsResponse>({
  ...DEFAULT_POINTS_STATE,
  awardedPoints: 0,
})

function awardPoints(originalText: string, pct: number): Promise<AwardPointsResponse> {
  awardPointsQueue = awardPointsQueue
    .catch(() => ({ ...DEFAULT_POINTS_STATE, awardedPoints: 0 }))
    .then(async () => {
      const current = await getPointsState()
      const awardedPoints = calculateAwardedPoints(originalText, pct)
      if (awardedPoints === 0) {
        return { ...current, awardedPoints }
      }

      const today = new Date().toISOString().slice(0, 10)
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      let { streakDays, lastActiveDate } = current
      if (lastActiveDate !== today) {
        streakDays = lastActiveDate === yesterday ? streakDays + 1 : 1
        lastActiveDate = today
      }

      const next = {
        ...current,
        pointsTotal: current.pointsTotal + awardedPoints,
        streakDays,
        lastActiveDate,
      }
      await chrome.storage.sync.set(next)
      return { ...next, awardedPoints }
    })

  return awardPointsQueue
}

chrome.runtime.onMessage.addListener(
  (msg: BackgroundMessage, _sender, sendResponse) => {
    if (msg.type === 'TRANSLATE_BLOCKS') {
      translateTexts(msg.texts, msg.targetLang)
        .then(sendResponse)
        .catch((err: unknown) => {
          console.error('[Langblock]', err)
          sendResponse(null)
        })
      return true
    }

    if (msg.type === 'SCORE_SIMILARITY') {
      ensureOffscreen()
        .then(() =>
          chrome.runtime.sendMessage(
            { target: 'offscreen', type: 'score', textA: msg.textA, textB: msg.textB },
            sendResponse,
          ),
        )
        .catch((err: unknown) => {
          console.error('[Langblock] offscreen error', err)
          sendResponse({ error: String(err) })
        })
      return true
    }

    if (msg.type === 'GET_POINTS_STATE') {
      getPointsState()
        .then(sendResponse)
        .catch((err: unknown) => {
          console.error('[Langblock] points state error', err)
          sendResponse(DEFAULT_POINTS_STATE)
        })
      return true
    }

    if (msg.type === 'SET_POINTS_OVERLAY') {
      setPointsOverlay(msg.show)
        .then(sendResponse)
        .catch((err: unknown) => {
          console.error('[Langblock] points overlay error', err)
          sendResponse(DEFAULT_POINTS_STATE)
        })
      return true
    }

    if (msg.type === 'AWARD_POINTS') {
      awardPoints(msg.originalText, Math.max(0, Math.min(100, msg.pct)))
        .then(sendResponse)
        .catch((err: unknown) => {
          console.error('[Langblock] award points error', err)
          sendResponse({ ...DEFAULT_POINTS_STATE, awardedPoints: 0 })
        })
      return true
    }
  },
)
