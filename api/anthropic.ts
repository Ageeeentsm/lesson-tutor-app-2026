// Vercel Serverless Function: proxies requests to Anthropic using the
// ANTHROPIC_API_KEY environment variable configured in Vercel.
// Runs on Node.js (not Edge) so we can use a longer maxDuration.
// Edge functions must start responding within ~25s, which Anthropic
// frequently exceeds — that's the source of the 504 you were seeing.
export const config = { maxDuration: 60 };

const ANTHROPIC_TIMEOUT_MS = 50000;

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured in Vercel.', provider: 'anthropic' });
  }

  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body || {});
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ANTHROPIC_TIMEOUT_MS);

  try {
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: rawBody,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const text = await upstream.text();
    res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
    return res.status(upstream.status).send(text);
  } catch (err: any) {
    clearTimeout(timeoutId);
    const isAbort = err?.name === 'AbortError';
    return res.status(isAbort ? 504 : 502).json({
      error: isAbort
        ? `Anthropic timed out after ${ANTHROPIC_TIMEOUT_MS / 1000}s.`
        : `Anthropic request failed: ${err?.message || String(err)}`,
      provider: 'anthropic',
    });
  }
}