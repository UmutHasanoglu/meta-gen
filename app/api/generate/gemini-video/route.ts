import { NextRequest } from 'next/server';
export const runtime = 'edge';

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

function parseDataUrl(dataUrl: string): { mime: string; base64: string } {
  const m = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl);
  if (!m) throw new Error('Invalid data URL');
  return { mime: m[1], base64: m[2] };
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface FileUploadResponse {
  file: {
    name: string;
    displayName: string;
    mimeType: string;
    sizeBytes: string;
    createTime: string;
    updateTime: string;
    expirationTime: string;
    sha256Hash: string;
    uri: string;
    state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
  };
}

interface FileGetResponse {
  name: string;
  displayName: string;
  mimeType: string;
  sizeBytes: string;
  createTime: string;
  updateTime: string;
  expirationTime: string;
  sha256Hash: string;
  uri: string;
  state: 'PROCESSING' | 'ACTIVE' | 'FAILED';
}

async function uploadVideoToGemini(apiKey: string, base64Data: string, mimeType: string): Promise<string> {
  // Convert base64 to binary
  const binaryData = Uint8Array.from(atob(base64Data), c => c.charCodeAt(0));

  // Start resumable upload
  const initResponse = await fetch(
    `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`,
    {
      method: 'POST',
      headers: {
        'X-Goog-Upload-Protocol': 'resumable',
        'X-Goog-Upload-Command': 'start',
        'X-Goog-Upload-Header-Content-Length': String(binaryData.length),
        'X-Goog-Upload-Header-Content-Type': mimeType,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        file: { displayName: `video-${Date.now()}` }
      })
    }
  );

  if (!initResponse.ok) {
    const text = await initResponse.text();
    throw new Error(`Failed to initiate upload: ${text}`);
  }

  const uploadUrl = initResponse.headers.get('X-Goog-Upload-URL');
  if (!uploadUrl) {
    throw new Error('No upload URL returned');
  }

  // Upload the video data
  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      'X-Goog-Upload-Command': 'upload, finalize',
      'X-Goog-Upload-Offset': '0',
      'Content-Type': mimeType,
    },
    body: binaryData
  });

  if (!uploadResponse.ok) {
    const text = await uploadResponse.text();
    throw new Error(`Failed to upload video: ${text}`);
  }

  const uploadResult: FileUploadResponse = await uploadResponse.json();
  return uploadResult.file.name;
}

async function waitForFileProcessing(apiKey: string, fileName: string, maxWaitMs = 120000): Promise<string> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Failed to check file status: ${text}`);
    }

    const fileInfo: FileGetResponse = await response.json();

    if (fileInfo.state === 'ACTIVE') {
      return fileInfo.uri;
    }

    if (fileInfo.state === 'FAILED') {
      throw new Error('Video processing failed');
    }

    // Still processing, wait and retry
    await sleep(2000);
  }

  throw new Error('Video processing timed out');
}

export async function POST(req: NextRequest) {
  try {
    const { apiKey, model, instruction, instructionHash, imageDataUrl } = (await req.json()) as {
      apiKey: string;
      model: string;
      instruction?: string;
      instructionHash?: string;
      imageDataUrl: string;
    };

    if (!apiKey) return new Response('Missing apiKey', { status: 400 });
    if (!model) return new Response('Missing model', { status: 400 });
    if (!imageDataUrl) return new Response('Missing video data', { status: 400 });

    if (instruction && instructionHash && !instructionCache.has(instructionHash)) {
      instructionCache.set(instructionHash, instruction);
    }
    const sys = instructionCache.get(instructionHash ?? '') ?? instruction ?? '';

    const { mime, base64 } = parseDataUrl(imageDataUrl);

    // Check if it's a video
    if (!mime.startsWith('video/')) {
      return new Response('Expected video file', { status: 400 });
    }

    // Upload video to Gemini Files API
    const fileName = await uploadVideoToGemini(apiKey, base64, mime);

    // Wait for processing to complete
    const fileUri = await waitForFileProcessing(apiKey, fileName);

    // Generate content with the video
    const payload: Record<string, unknown> = {
      ...(sys ? { systemInstruction: { role: 'user', parts: [{ text: sys }] } } : {}),
      contents: [
        {
          role: 'user',
          parts: [
            { text: 'Analyze this video and return metadata for a stock video agency. Consider the overall content, mood, subjects, actions, and setting shown throughout the video.' },
            { fileData: { mimeType: mime, fileUri } }
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
      console.error('Gemini video error', resp.status, text);
      return new Response(`Gemini error (${resp.status}): ${text}`, { status: 500 });
    }

    try {
      const json = JSON.parse(text) as {
        candidates?: { content?: { parts?: { text?: string }[] } }[];
      };
      const candidateText = json.candidates?.[0]?.content?.parts?.[0]?.text;
      const out = typeof candidateText === 'string' ? candidateText : text;
      return new Response(out, { headers: { 'Content-Type': 'application/json' } });
    } catch {
      return new Response(text, { headers: { 'Content-Type': 'application/json' } });
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('Video processing error', msg);
    return new Response(`Server error: ${msg}`, { status: 500 });
  }
}
