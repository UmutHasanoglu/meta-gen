'use client';

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Copy, Download, ImageIcon, History as HistoryIcon } from 'lucide-react';
import { nanoid } from 'nanoid/non-secure';
import { resizeImageToMax1024 } from '@/lib/resize';
import { sha256 } from '@/lib/hash';
import { downloadAgencyCSV } from '@/lib/csv';
import { saveHistoryItem, loadHistory, saveApiKey, getApiKey } from '@/lib/store';
import type { FileType, ItemMetaBox, MetaOutput } from '@/lib/types';

const OPENAI_MODELS = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1']; // vision-capable first
const GEMINI_MODELS = ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'];
const DEFAULT_EXTRA = '';

// ---------- instruction text ----------
function defaultInstruction(opts: {
  fileType: FileType;
  titleLength: number;
  descriptionLength: number;
  keywordsCount: number;
  extra: string;
}) {
  const { fileType, titleLength, descriptionLength, keywordsCount, extra } = opts;
  return `You are a professional stock photography metadata generator. Analyze the provided image and generate metadata for a stock photo agency.

**File Type:** ${fileType}.

**Instructions:**
1. **General Guidelines for Titles and Keywords**
   - **Title and Description:** Create a concise, descriptive, and commercially appealing title around ${titleLength} characters. Write a detailed description around ${descriptionLength} words. Capitalize only the first word and proper nouns. Avoid special characters. Include important title words in the top 10 keywords. Avoid brand or people's names.
   - **Keyword Best Practices:** Use singular nouns. Use factual adjectives (color, texture) and avoid subjective ones (cute, beautiful). Generate exactly ${keywordsCount} comma-separated, SEO-friendly keywords. The first 10 keywords are the most important.

2. **Guidelines for People**
   - **Representation:** Describe subjects accurately. Include gender, age, and ethnicity/race if known.
   - **Details:** Identify activities (e.g., run, jump), roles (e.g., mother, colleague), and expressions (e.g., smile). Be inclusive and factual.

3. **Guidelines for Other Asset Categories**
   - **Objects:** Use specific singular nouns (e.g., armchair). Describe patterns, colors, and arrangements. Add "no people" if applicable.
   - **Animals:** Use specific species names. Include number, gender, or age if relevant.
   - **Places:** Mention specific locations (e.g., Eiffel Tower, Paris). Describe the setting (urban, rural, season, weather).
   - **Plants & Flowers:** Use specific names (e.g., marigold). Describe appearance (blooming, dewy) and parts (petal, stem).
   - **Food & Drinks:** Use specific singular nouns (e.g., pizza). Describe taste, texture, or cultural significance.
   - **Illustrations & Vectors:** Specify the style (illustration, vector, 3d render). Describe the subject and theme.
   - **Transparent Backgrounds:** If the asset has a transparent background (especially for a ${fileType}), include keywords like "transparent background", "cutout", and "isolated".

${extra ? `**Additional Instructions:** ${extra}` : ''}

**Output Format:**
Provide the output in a strict JSON format. Do not include any text before or after the JSON object. The JSON object must have three keys: "title", "description", and "keywords". The "keywords" value must be a single string of comma-separated values.

Example JSON output:
{
  "title": "A sample title for an image",
  "description": "A sample description of what is in the image and its concepts.",
  "keywords": "keyword1, keyword2, keyword3, ..."
}`;
}

// ---------- helpers: retry, concurrency, validation ----------
function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function withRetry<T>(fn: () => Promise<T>, tries = 3, backoffMs = 600): Promise<T> {
  let last: unknown;
  for (let t = 0; t < tries; t++) {
    try {
      return await fn();
    } catch (e: unknown) {
      last = e;
      if (t < tries - 1) await sleep(backoffMs * (t + 1));
    }
  }
  throw last;
}

function isValidMeta(x: unknown): x is MetaOutput {
  const obj = x as Partial<MetaOutput> | null;
  return !!obj && typeof obj.title === 'string' && typeof obj.description === 'string' && typeof obj.keywords === 'string';
}

async function pLimit<T>(
  concurrency: number,
  tasks: Array<() => Promise<T>>,
  onUpdate?: (ret: Array<T | undefined>) => void
): Promise<T[]> {
  const ret: Array<T | undefined> = new Array(tasks.length);
  let next = 0;
  let active = 0;

  return new Promise<T[]>((resolve) => {
    const run = () => {
      while (active < concurrency && next < tasks.length) {
        const idx = next++;
        active++;
        tasks[idx]()
          .then((r) => {
            ret[idx] = r;
            onUpdate?.(ret);
          })
          .finally(() => {
            active--;
            if (next === tasks.length && active === 0) {
              resolve(ret as T[]);
            } else {
              run();
            }
          });
      }
    };
    run();
  });
}
// -------------------------------------------------------------

export default function App() {
  const [provider, setProvider] = useState<'openai' | 'gemini'>('openai');
  const [model, setModel] = useState(OPENAI_MODELS[0]);
  const [apiKey, setApiKey] = useState('');

  const [fileType, setFileType] = useState<FileType>('photo');
  const [titleLength, setTitleLength] = useState(60);
  const [descriptionLength, setDescriptionLength] = useState(60);
  const [keywordsCount, setKeywordsCount] = useState(49);
  const [extra, setExtra] = useState(DEFAULT_EXTRA);

  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<ItemMetaBox[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const [tab, setTab] = useState<'generate' | 'history'>('generate');

  const [histPage, setHistPage] = useState(0);
  const pageSize = 100;
  const [hist, setHist] = useState<{ items: ItemMetaBox[]; total: number }>({ items: [], total: 0 });

  useEffect(() => {
    setApiKey(getApiKey(provider));
    setModel(provider === 'openai' ? OPENAI_MODELS[0] : GEMINI_MODELS[0]);
  }, [provider]);

  const refreshHistory = useCallback(async () => {
    const h = await loadHistory(histPage, pageSize);
    setHist(h);
  }, [histPage, pageSize]);

  useEffect(() => {
    if (tab === 'history') void refreshHistory();
  }, [tab, refreshHistory]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const fl = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'));
    setFiles((prev) => [...prev, ...fl]);
  }
  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const fl = Array.from(e.target.files || []).filter((f) => f.type.startsWith('image/'));
    setFiles((prev) => [...prev, ...fl]);
  }

  async function runGeneration() {
    if (!files.length) return;
    if (!apiKey) {
      alert('Please enter your API key.');
      return;
    }
    setBusy(true);
    setProgress(0);
    setItems([]);

    const instr = defaultInstruction({ fileType, titleLength, descriptionLength, keywordsCount, extra });
    const instructionHash = await sha256(instr);

    const genOne = async (file: File): Promise<ItemMetaBox> => {
      try {
        const { dataUrl } = await resizeImageToMax1024(file);
        const body = {
          apiKey,
          model,
          instruction: instr,
          instructionHash,
          imageDataUrl: dataUrl
        };
        const url = provider === 'openai' ? '/api/generate/openai' : '/api/generate/gemini';

        const res = await withRetry(
          () =>
            fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body)
            }).then(async (r) => {
              if (!r.ok) {
                const t = await r.text();
                throw new Error(t || `HTTP ${r.status}`);
              }
              return r;
            }),
          3,
          600
        );

        const parsed: unknown = await res.json();
        if (!isValidMeta(parsed)) {
          throw new Error('Model returned invalid JSON shape.');
        }

        const box: ItemMetaBox = {
          id: nanoid(),
          filename: file.name,
          fileType,
          createdAt: Date.now(),
          thumbDataUrl: dataUrl,
          meta: parsed
        };
        await saveHistoryItem(box);
        return box;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const box: ItemMetaBox = {
          id: nanoid(),
          filename: file.name,
          fileType,
          createdAt: Date.now(),
          error: msg
        };
        await saveHistoryItem(box);
        return box;
      }
    };

    const tasks = files.map((f) => () => genOne(f));

    await pLimit<ItemMetaBox>(4, tasks, (ret) => {
      const done = ret.filter(Boolean).length;
      setProgress(Math.round((done / files.length) * 100));
      setItems(ret.filter(Boolean) as ItemMetaBox[]);
    });

    setBusy(false);
    setFiles([]);
  }

  function copy(text: string) {
    void navigator.clipboard.writeText(text || '');
  }

  const totalPages = Math.ceil(hist.total / pageSize);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <ImageIcon className="w-6 h-6" />
        <h1 className="text-xl md:text-2xl font-semibold">Stock Image Metadata Generator</h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'generate' | 'history')}>
        <TabsList className="grid grid-cols-2 w-full md:w-auto">
          <TabsTrigger value="generate">Generate</TabsTrigger>
          <TabsTrigger value="history">
            <HistoryIcon className="w-4 h-4 mr-1" />
            History
          </TabsTrigger>
        </TabsList>

        <TabsContent value="generate" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Provider & Model</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as 'openai' | 'gemini')}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(provider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>{provider === 'openai' ? 'OpenAI API key' : 'Gemini API key'}</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-... or AIza..."
                  />
                  <Button variant="secondary" onClick={() => saveApiKey(provider, apiKey)}>
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              <div>
                <Label>File type</Label>
                <Select value={fileType} onValueChange={(v) => setFileType(v as FileType)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="illustration">Illustration</SelectItem>
                    <SelectItem value="vector">Vector</SelectItem>
                    <SelectItem value="icon">Icon</SelectItem>
                    <SelectItem value="transparent_png">Transparent PNG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Title length (chars)</Label>
                <Input
                  type="number"
                  min={20}
                  max={80}
                  value={titleLength}
                  onChange={(e) => setTitleLength(parseInt(e.target.value || '60', 10))}
                />
              </div>
              <div>
                <Label>Description length (words)</Label>
                <Input
                  type="number"
                  min={20}
                  max={120}
                  value={descriptionLength}
                  onChange={(e) => setDescriptionLength(parseInt(e.target.value || '60', 10))}
                />
              </div>
              <div>
                <Label>Keywords count</Label>
                <Input
                  type="number"
                  min={5}
                  max={50}
                  value={keywordsCount}
                  onChange={(e) => setKeywordsCount(parseInt(e.target.value || '49', 10))}
                />
              </div>
              <div className="md:col-span-2">
                <Label>Extra instructions</Label>
                <Textarea
                  rows={3}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="Add any project-specific guidance here..."
                />
              </div>
            </CardContent>
          </Card>

          <Card onDrop={onDrop} onDragOver={(e) => e.preventDefault()}>
            <CardHeader>
              <CardTitle>Upload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="border border-neutral-800 rounded-2xl p-6 text-neutral-300 text-center">
                Drag & drop images here or
                <div className="mt-3">
                  <Input type="file" accept="image/*" multiple onChange={onPick} />
                </div>
              </div>
              {!!files.length && (
                <div className="text-sm text-neutral-400">
                  <strong>{files.length}</strong> file(s) selected:
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {files.map((f) => (
                      <li key={f.name}>{f.name}</li>
                    ))}
                  </ul>
                  <div className="text-xs mt-2">(Previews are hidden until metadata is generated)</div>
                </div>
              )}
              <div className="flex gap-2 items-center">
                <Button disabled={!files.length || busy} onClick={runGeneration}>
                  Generate metadata
                </Button>
                {busy && <Progress value={progress} className="w-56" />}
                {busy && (
                  <span className="text-sm text-neutral-400">
                    {Math.round(progress)}% | {Math.round((progress / 100) * files.length)} / {files.length}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {!!items.length && (
            <Card>
              <CardHeader>
                <CardTitle>Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Button variant="secondary" onClick={() => downloadAgencyCSV('adobe', items)}>
                    <Download className="w-4 h-4 mr-2" />
                    Adobe CSV
                  </Button>
                  <Button variant="secondary" onClick={() => downloadAgencyCSV('shutterstock', items)}>
                    <Download className="w-4 h-4 mr-2" />
                    Shutterstock CSV
                  </Button>
                  <Button variant="secondary" onClick={() => downloadAgencyCSV('vecteezy', items)}>
                    <Download className="w-4 h-4 mr-2" />
                    Vecteezy CSV
                  </Button>
                  <Button variant="secondary" onClick={() => downloadAgencyCSV('freepik', items)}>
                    <Download className="w-4 h-4 mr-2" />
                    Freepik CSV
                  </Button>
                  <Button variant="secondary" onClick={() => downloadAgencyCSV('dreamstime', items)}>
                    <Download className="w-4 h-4 mr-2" />
                    Dreamstime CSV
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {items.map((it) => (
                    <div key={it.id} className="rounded-2xl border border-neutral-800 overflow-hidden">
                      <div className="flex gap-3 p-3 items-center bg-neutral-900">
                        <div className="w-16 h-16 bg-neutral-800 rounded-lg overflow-hidden flex items-center justify-center">
                          {it.thumbDataUrl ? (
                            <img alt="" src={it.thumbDataUrl} className="object-cover w-full h-full" />
                          ) : (
                            <span className="text-xs text-neutral-500">No preview</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate">{it.filename}</div>
                          <div className="text-xs text-neutral-400">{new Date(it.createdAt).toLocaleString()}</div>
                        </div>
                        {it.error && <Badge variant="destructive" className="ml-auto">Error</Badge>}
                      </div>
                      <div className="p-4 space-y-2">
                        {it.error ? (
                          <pre className="text-red-400 text-sm whitespace-pre-wrap">{it.error}</pre>
                        ) : (
                          <>
                            <div className="flex items-start gap-2">
                              <div className="font-semibold min-w-[70px]">Title</div>
                              <div className="flex-1 text-neutral-200">{it.meta?.title}</div>
                              <Button size="icon" variant="ghost" onClick={() => copy(it.meta?.title || '')}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="font-semibold min-w-[70px]">Desc</div>
                              <div className="flex-1 text-neutral-300">{it.meta?.description}</div>
                              <Button size="icon" variant="ghost" onClick={() => copy(it.meta?.description || '')}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="font-semibold min-w-[70px]">Keywords</div>
                              <div className="flex-1 text-neutral-300 break-words">{it.meta?.keywords}</div>
                              <Button size="icon" variant="ghost" onClick={() => copy(it.meta?.keywords || '')}>
                                <Copy className="w-4 h-4" />
                              </Button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                {hist.items.map((it) => (
                  <div key={it.id} className="rounded-2xl border border-neutral-800 overflow-hidden">
                    <div className="flex gap-3 p-3 items-center bg-neutral-900">
                      <div className="w-16 h-16 bg-neutral-800 rounded-lg overflow-hidden flex items-center justify-center">
                        {it.thumbDataUrl ? (
                          <img alt="" src={it.thumbDataUrl} className="object-cover w-full h-full" />
                        ) : (
                          <span className="text-xs text-neutral-500">No preview</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium truncate">{it.filename}</div>
                        <div className="text-xs text-neutral-400">{new Date(it.createdAt).toLocaleString()}</div>
                      </div>
                      {it.error && <Badge variant="destructive" className="ml-auto">Error</Badge>}
                    </div>
                    <div className="p-4 space-y-2">
                      {it.error ? (
                        <pre className="text-red-400 text-sm whitespace-pre-wrap">{it.error}</pre>
                      ) : (
                        <>
                          <div className="text-sm">
                            <span className="font-semibold">Title: </span>
                            {it.meta?.title}
                          </div>
                          <div className="text-sm text-neutral-300">
                            <span className="font-semibold">Desc: </span>
                            {it.meta?.description}
                          </div>
                          <div className="text-sm text-neutral-300">
                            <span className="font-semibold">Keywords: </span>
                            {it.meta?.keywords}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Button
                      key={i}
                      variant={i === histPage ? 'default' : 'secondary'}
                      onClick={() => setHistPage(i)}
                    >
                      {i + 1}
                    </Button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
