import { NextRequest } from 'next/server';
export const runtime = 'edge';

// Strict JSON schema for the response
const responseSchema = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING' },
    description: { type: 'STRING' },
    keywords: { type: 'STRING' } // comma-separated
  },
  required: ['title', 'description', 'keywords']
} as const;

const instructionCache = new Map<string, string>();

function parseDataUrl(dataUrl: string): { mime: string; base64: string } {
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl);
  if (!m) throw new Error('Invalid data URL');
  return { mime: m[1], base64: m[2] };
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, model, instruction, instructionHash, imageDataUrl } = await req.json();

    if (!apiKey) return new Response('Missing apiKey', { status: 400 });
    if (!model) return new Response('Missing model', { status: 400 });
    if (!imageDataUrl) return new Response('Missing imageDataUrl', { status: 400 });

    if (instruction && instructionHash && !instructionCache.has(instructionHash)) {
      instructionCache.set(instructionHash, instruction);
    }
    const sys = instructionCache.get(instructionHash) || instruction || '';

    const { mime, base64 } = parseDataUrl(imageDataUrl);

    const payload: any = {
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

    let out = '';
    try {
      const json = JSON.parse(text);
      const candidateText =
        json.candidates?.[0]?.content?.parts?.[0]?.text ??
        json.candidates?.[0]?.content?.parts?.[0]?.inline_data?.data;
      out = typeof candidateText === 'string' ? candidateText : text;
    } catch {
      out = text;
    }

    return new Response(out, { headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    console.error('Server error', e);
    return new Response(`Server error: ${e?.message || e}`, { status: 500 });
  }
}
