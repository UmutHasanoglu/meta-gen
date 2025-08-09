import { NextRequest } from 'next/server';
export const runtime = 'edge';

// JSON Schema used by Structured Outputs
const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    keywords: { type: 'string' } // comma-separated
  },
  required: ['title', 'description', 'keywords']
} as const;

const instructionCache = new Map<string, string>();

export async function POST(req: NextRequest) {
  try {
    const { apiKey, model, instruction, instructionHash, imageDataUrl } = (await req.json()) as {
      apiKey: string;
      model: string;
      instruction?: string;
      instructionHash?: string;
      imageDataUrl: string; // data URL
    };

    if (!apiKey) return new Response('Missing apiKey', { status: 400 });
    if (!model) return new Response('Missing model', { status: 400 });
    if (!imageDataUrl) return new Response('Missing imageDataUrl', { status: 400 });

    if (instruction && instructionHash && !instructionCache.has(instructionHash)) {
      instructionCache.set(instructionHash, instruction);
    }
    const sys = instructionCache.get(instructionHash ?? '') ?? instruction ?? '';

    const payload = {
      model,                     // e.g., "gpt-4o"
      instructions: sys,         // system prompt
      text: {                    // Structured Outputs location
        format: {
          type: 'json_schema',
          name: 'StockMeta',
          schema: jsonSchema,
          strict: true
        }
      },
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Analyze the image and return metadata JSON.' },
            { type: 'input_image', image_url: imageDataUrl }
          ]
        }
      ]
    };

    const resp = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const bodyText = await resp.text();
    if (!resp.ok) {
      console.error('OpenAI error', resp.status, bodyText);
      return new Response(`OpenAI error (${resp.status}): ${bodyText}`, { status: 500 });
    }

    const json = JSON.parse(bodyText) as {
      output_text?: string;
      output?: { content?: { text?: string }[] }[];
    };
    const out = json.output_text ?? json.output?.[0]?.content?.[0]?.text ?? bodyText;

    return new Response(out, { headers: { 'Content-Type': 'application/json' } });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Server error', msg);
    return new Response(`Server error: ${msg}`, { status: 500 });
  }
}
