// Vercel serverless function: POST /api/chat  { question } -> { answer, source }
// 1) OpenRouter free models   2) fallback: Google Gemini (only if GEMINI_API_KEY is set)
const SYSTEM = 'You are the NutriTrack helper. The user names a food or meal. Reply in plain, simple English in at most 90 words. Start with one verdict line: "Healthy choice", "Okay in moderation" or "Eat sparingly". Then give 2 or 3 short reasons and one easy tip. Give general nutrition information only, not medical advice. If the question is not about food or nutrition, politely say you can only help with food questions.';
const TIMEOUT_MS = 25000;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function postJson(url: string, headers: Record<string, string>, body: unknown): Promise<any> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body), signal: ctrl.signal });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(timer); }
}

async function viaOpenRouter(question: string, key: string): Promise<string> {
  // Free model names change often, so we default to OpenRouter's free router. You can list your own, comma separated, in OPENROUTER_MODELS.
  const custom = (process.env.OPENROUTER_MODELS || '').split(',').map(s => s.trim()).filter(Boolean);
  const body: Record<string, unknown> = { messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: question }], max_tokens: 400, temperature: 0.3 };
  if (custom.length) body.models = [...custom, 'openrouter/free']; else body.model = 'openrouter/free';
  const data = await postJson('https://openrouter.ai/api/v1/chat/completions', {
    Authorization: 'Bearer ' + key, 'HTTP-Referer': process.env.SITE_URL || 'https://vercel.app', 'X-Title': 'NutriTrack',
  }, body);
  const text = String(data?.choices?.[0]?.message?.content ?? '').trim();
  if (!text) throw new Error('empty answer');
  return text;
}

async function viaGemini(question: string, key: string): Promise<string> {
  const model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
  const data = await postJson('https://generativelanguage.googleapis.com/v1beta/models/' + model + ':generateContent', { 'x-goog-api-key': key }, {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: question }] }],
    generationConfig: { maxOutputTokens: 800, temperature: 0.3 },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const text = (data?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p?.text ?? '').join('').trim();
  if (!text) throw new Error('empty answer');
  return text;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ error: 'Use POST.' }); }
  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = {}; } }
  const question = String(body?.question ?? '').trim().slice(0, 500);
  if (question.length < 2) return res.status(400).json({ error: 'Please type a food or a question.' });

  const orKey = process.env.OPENROUTER_API_KEY;
  const gKey = process.env.GEMINI_API_KEY;
  if (!orKey && !gKey) return res.status(503).json({ error: 'The AI helper is not set up yet. The site owner needs to add an API key.' });

  const attempts: Array<[string, () => Promise<string>]> = [];
  if (orKey) { attempts.push(['OpenRouter', () => viaOpenRouter(question, orKey)]); attempts.push(['OpenRouter', () => viaOpenRouter(question, orKey)]); } // 2 tries: the free router may pick a different model
  if (gKey) attempts.push(['Gemini (backup)', () => viaGemini(question, gKey)]);

  for (const [name, run] of attempts) {
    try {
      const answer = await run();
      if (answer) return res.status(200).json({ answer, source: name });
    } catch (e) { console.error(name + ' failed:', e instanceof Error ? e.message : e); }
  }
  return res.status(502).json({ error: 'The AI helpers are busy right now. Please try again in a minute.' });
}
