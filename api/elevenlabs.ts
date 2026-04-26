// Vercel Serverless Function: proxies TTS requests to ElevenLabs.
// Requires ELEVENLABS_API_KEY in Vercel env vars.
export const config = { maxDuration: 60 };

const DEFAULT_VOICE_ID = 'CiGXiF6vr3ULNlgVfZ5z'; // Nigerian voice

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).send('Method Not Allowed');
  }
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'ELEVENLABS_API_KEY is not configured in Vercel.' });
  }

  const payload: any = req.body || {};
  const text = (payload?.text || '').toString().slice(0, 4000);
  if (!text) {
    return res.status(400).json({ error: 'Missing text' });
  }
  const voiceId = (payload?.voiceId || DEFAULT_VOICE_ID).toString();

  const upstream = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.4,
          use_speaker_boost: true,
        },
      }),
    }
  );

  if (!upstream.ok) {
    const errText = await upstream.text();
    return res.status(upstream.status).json({ error: 'ElevenLabs error', status: upstream.status, detail: errText });
  }

  res.setHeader('content-type', 'audio/mpeg');
  res.setHeader('cache-control', 'no-store');
  const buffer = Buffer.from(await upstream.arrayBuffer());
  return res.status(200).send(buffer);
}