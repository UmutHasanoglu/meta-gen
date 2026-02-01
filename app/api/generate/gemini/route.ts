import { NextRequest } from 'next/server';
export const runtime = 'edge';

// Allowed models for Gemini
const ALLOWED_MODELS = [
  'gemini-3-pro-preview', 'gemini-3-flash-preview',
  'gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite',
  'gemini-2.0-flash', 'gemini-1.5-pro', 'gemini-1.5-flash'
];

// Strict JSON schema for the response
const responseSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    keywords: { type: 'STRING' }
  },
  required: ['title', 'description', 'keywords']
} as const;

const instructionCache = new Map<string, string>();

function isValidApiKey(key: string): boolean {
  // Gemini keys start with 'AIza' and are typically 39 chars
  return typeof key === 'string' && key.startsWith('AIza') && key.length >= 30;
}

function isValidDataUrl(url: string): boolean {
  return typeof url === 'string' && /^data:image\/[a-z]+;base64,/i.test(url);
}

function isValidModel(model: string): boolean {
  return typeof model === 'string' && ALLOWED_MODELS.includes(model);
}

function parseDataUrl(dataUrl: string): { mime: string; base64: string } {
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl);
  if (!m) throw new Error('Invalid data URL');
  return { mime: m[1], base64: m[2] };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export async function POST(req: NextRequest) {
  try {
    // Rate limit delay
    await sleep(5000);

    const body = await req.json();
    const { apiKey, model, instruction, instructionHash, imageDataUrl } = body as {
      apiKey: string;
      model: string;
      instruction?: string;
      instructionHash?: string;
      imageDataUrl: string;
    };

    // Input validation
    if (!apiKey) {
      return new Response('Missing apiKey', { status: 400 });
    }
    if (!isValidApiKey(apiKey)) {
      return new Response('Invalid API key format', { status: 400 });
    }
    if (!model) {
      return new Response('Missing model', { status: 400 });
    }
    if (!isValidModel(model)) {
      return new Response(`Invalid model. Allowed: ${ALLOWED_MODELS.join(', ')}`, { status: 400 });
    }
    if (!imageDataUrl) {
      return new Response('Missing imageDataUrl', { status: 400 });
    }
    if (!isValidDataUrl(imageDataUrl)) {
      return new Response('Invalid image data URL format', { status: 400 });
    }

    // Cache instruction for batch processing
    if (instruction && instructionHash && !instructionCache.has(instructionHash)) {
      instructionCache.set(instructionHash, instruction);
    }
    const sys = instructionCache.get(instructionHash ?? '') ?? instruction ?? '';

    const { mime, base64 } = parseDataUrl(imageDataUrl);

    const payload: Record<string, unknown> = {
      ...(sys ? { systemInstruction: { role: 'user', parts: [{ text: sys }] } } : {}),
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Analyze the image and return strict JSON.' },
            { inline_data: { mime_type: mime, data: base64 } }
          ]
        }
      ],
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema
      }
    };

    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey
        },
        body: JSON.stringify(payload)
      }
    );

    const text = await resp.text();
    if (!resp.ok) {
      console.error('Gemini error', resp.status, text);
      return new Response(`Gemini error (${resp.status}): ${text}`, { status: 500 });
    }

    try {
      const json = JSON.parse(text) as {
        candidates?: { content?: { parts?: { text?: string; inline_data?: { data?: string } }[] } }[];
      };
      const candidateText =
        json.candidates?.[0]?.content?.parts?.[0]?.text ??
        json.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data;
      const out = typeof candidateText === 'string' ? candidateText : text;
      return new Response(out, { headers: { 'Content-Type': 'application/json' } });
    } catch {
      return new Response(text, { headers: { 'Content-Type': 'application/json' } });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Server error', msg);
    return new Response(`Server error: ${msg}`, { status: 500 });
  }
}
