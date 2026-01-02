'use client';

import { useCallback, useEffect, useMemo, useState, useId } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Copy,
  Download,
  ImageIcon,
  History as HistoryIcon,
  RotateCw,
  Save,
  Wand2,
  CheckSquare,
  Square,
  Plus,
} from 'lucide-react';
import { nanoid } from 'nanoid/non-secure';
import { resizeImageToMax1024 } from '@/lib/resize';
import { sha256 } from '@/lib/hash';
import { downloadAgencyCSV } from '@/lib/csv';
import { saveHistoryItem, loadHistory, saveApiKey, getApiKey } from '@/lib/store';
import { cleanKeywords, parseKeywords } from '@/lib/keywords';
import type { FileType, ItemMetaBox, MetaOutput } from '@/lib/types';

/* ---------- constants ---------- */
const OPENAI_MODELS = ['gpt-5.2', 'gpt-5.1', 'gpt-5', 'o4-mini', 'o3', 'o3-mini', 'gpt-4o', 'gpt-4.1'];
const GEMINI_MODELS = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];
const DEFAULT_EXTRA = '';

/* ---------- instruction text ---------- */
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
   - **Objects:** Use specific singular nouns (e.g., armchair). Describe patterns, colors, and arrangements.
   - **Animals:** Use specific species names. Include number, gender, or age if relevant.
   - **Places:** Describe the setting (urban, rural, season, weather).
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

/* ---------- helpers: retry, concurrency, validation ---------- */
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
            if (next === tasks.length && active === 0) resolve(ret as T[]);
            else run();
          });
      }
    };
    run();
  });
}

/* ---------- custom file picker (accessible) ---------- */
function FilePicker({ onPick }: { onPick: (files: File[]) => void }) {
  const id = useId();
  return (
    <div className="inline-flex items-center gap-2">
      <input
        id={id}
        type="file"
        accept="image/*"
        multiple
        className="sr-only"
        onChange={(e) => onPick(Array.from(e.target.files || []))}
      />
      <label
        htmlFor={id}
        className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 rounded-lg
                   bg-purple-600 hover:bg-purple-500 text-white border border-purple-500/40
                   shadow-sm"
      >
        Select images
      </label>
    </div>
  );
}

/* ============================== PAGE ============================== */
export default function App() {
  const [provider, setProvider] = useState<'openai' | 'gemini'>('gemini');
  const [model, setModel] = useState(OPENAI_MODELS[0]);
  const [apiKey, setApiKey] = useState('');

  const [fileType, setFileType] = useState<FileType>('photo');
  const [titleLength, setTitleLength] = useState(70);
  const [descriptionLength, setDescriptionLength] = useState(60);
  const [keywordsCount, setKeywordsCount] = useState(35);
  const [extra, setExtra] = useState(DEFAULT_EXTRA);

  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<ItemMetaBox[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  const [tab, setTab] = useState<'generate' | 'history'>('generate');

  const [histPage, setHistPage] = useState(0);
  const pageSize = 100;
  const [hist, setHist] = useState<{ items: ItemMetaBox[]; total: number }>({ items: [], total: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // small input value for adding keyword per-item
  const [newKw, setNewKw] = useState<Record<string, string>>({});

  useEffect(() => {
    setApiKey(getApiKey(provider));
    setModel(provider === 'openai' ? OPENAI_MODELS[0] : GEMINI_MODELS[0]);
  }, [provider]);

  const refreshHistory = useCallback(async () => {
    const h = await loadHistory(histPage, pageSize);
    setHist(h);
    setSelectedIds(new Set()); // reset selection on page change
  }, [histPage, pageSize]);

  useEffect(() => {
    if (tab === 'history') void refreshHistory();
  }, [tab, refreshHistory]);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const fl = Array.from(e.dataTransfer.files || []).filter((f) => f.type.startsWith('image/'));
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
        const body = { apiKey, model, instruction: instr, instructionHash, imageDataUrl: dataUrl };
        const url = provider === 'openai' ? '/api/generate/openai' : '/api/generate/gemini';

        const res = await withRetry(
          () =>
            fetch(url, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            }).then(async (r) => {
              if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
              return r;
            }),
          3,
          600
        );

        const parsed: unknown = await res.json();
        if (!isValidMeta(parsed)) throw new Error('Model returned invalid JSON shape.');

        const fixed: MetaOutput = {
          title: parsed.title,
          description: parsed.description,
          keywords: cleanKeywords(parsed.keywords, keywordsCount),
        };

        const box: ItemMetaBox = {
          id: nanoid(),
          filename: file.name,
          fileType,
          createdAt: Date.now(),
          thumbDataUrl: dataUrl,
          meta: fixed,
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
          error: msg,
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

  /* ----- per-item helpers (edit, copy, tidy, add, regenerate) ----- */
  function copy(text: string) {
    void navigator.clipboard.writeText(text || '');
  }
  function patchItem(id: string, patch: Partial<ItemMetaBox>) {
    setItems((prev) => prev.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  }
  function patchItemMeta(id: string, patch: Partial<MetaOutput>) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, meta: { ...(it.meta || { title: '', description: '', keywords: '' }), ...patch } } : it
      )
    );
  }
  async function saveEdits(id: string) {
    const it = items.find((x) => x.id === id);
    if (it) await saveHistoryItem(it);
  }
  async function tidyKeywords(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it?.meta) return;
    const cleaned = cleanKeywords(it.meta.keywords, keywordsCount);
    const next = { ...it, meta: { ...(it.meta as MetaOutput), keywords: cleaned } };
    patchItem(it.id, next);
    await saveHistoryItem(next);
  }
  function onChipDrop(itemId: string, from: number, to: number) {
    const it = items.find((x) => x.id === itemId);
    if (!it?.meta) return;
    const arr = parseKeywords(it.meta.keywords);
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    const joined = arr.join(', ');
    patchItemMeta(itemId, { keywords: joined });
  }
  function addKeyword(itemId: string) {
    const it = items.find((x) => x.id === itemId);
    const kw = (newKw[itemId] || '').trim();
    if (!it || !kw) return;
    const arr = parseKeywords(it.meta?.keywords || '');
    const lower = new Set(arr.map((s) => s.toLowerCase()));
    if (lower.has(kw.toLowerCase())) {
      setNewKw((s) => ({ ...s, [itemId]: '' }));
      return;
    }
    arr.push(kw);
    patchItemMeta(itemId, { keywords: arr.join(', ') });
    setNewKw((s) => ({ ...s, [itemId]: '' }));
  }
  async function regenerate(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it?.thumbDataUrl) return;
    setBusy(true);
    try {
      const instr = defaultInstruction({
        fileType: it.fileType,
        titleLength,
        descriptionLength,
        keywordsCount,
        extra,
      });
      const instructionHash = await sha256(instr);
      const body = { apiKey, model, instruction: instr, instructionHash, imageDataUrl: it.thumbDataUrl };
      const url = provider === 'openai' ? '/api/generate/openai' : '/api/generate/gemini';

      const res = await withRetry(
        () =>
          fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
          }).then(async (r) => {
            if (!r.ok) throw new Error((await r.text()) || `HTTP ${r.status}`);
            return r;
          }),
        3,
        600
      );

      const parsed: unknown = await res.json();
      if (!isValidMeta(parsed)) throw new Error('Model returned invalid JSON shape.');
      const fixed: MetaOutput = {
        title: parsed.title,
        description: parsed.description,
        keywords: cleanKeywords(parsed.keywords, keywordsCount),
      };
      const updated: ItemMetaBox = { ...it, meta: fixed, error: undefined };
      patchItem(id, updated);
      await saveHistoryItem(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      patchItem(id, { error: msg });
    } finally {
      setBusy(false);
    }
  }

  /* ----- history selection helpers ----- */
  const totalPages = Math.ceil(hist.total / pageSize);
  const selectedCount = selectedIds.size;
  const allSelectable = hist.items.filter((i) => !i.error);
  const allSelected = selectedCount > 0 && selectedCount === allSelectable.length;

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }
  function toggleSelectAll() {
    setSelectedIds(() => {
      if (allSelected) return new Set();
      const next = new Set<string>();
      for (const it of allSelectable) next.add(it.id);
      return next;
    });
  }
  const selectedItems = useMemo(() => hist.items.filter((it) => selectedIds.has(it.id)), [hist.items, selectedIds]);

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="rounded-2xl p-4 bg-gradient-to-r from-purple-900/30 via-neutral-900 to-neutral-950 border border-neutral-800 flex items-center gap-3">
        <ImageIcon className="w-6 h-6 text-purple-300" />
        <h1 className="text-xl md:text-2xl font-semibold text-neutral-100">Stock Image Metadata Generator</h1>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'generate' | 'history')}>
        <TabsList
          className="grid grid-cols-2 w-full md:w-auto p-1 rounded-xl
                     bg-neutral-800/80 border border-neutral-700
                     text-neutral-200"
        >
          <TabsTrigger
            value="generate"
            className="rounded-lg px-4 py-2 transition
                       !text-neutral-200 hover:!text-white
                       data-[state=active]:!bg-purple-600
                       data-[state=active]:!text-white
                       data-[state=active]:shadow-sm"
          >
            Generate
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="rounded-lg px-4 py-2 transition
                       !text-neutral-200 hover:!text-white
                       data-[state=active]:!bg-purple-600
                       data-[state=active]:!text-white
                       data-[state=active]:shadow-sm"
          >
            <HistoryIcon className="w-4 h-4 mr-1" />
            History
          </TabsTrigger>
        </TabsList>

        {/* ============== GENERATE TAB ============== */}
        <TabsContent value="generate" className="space-y-6">
          {/* Provider/Model */}
          <Card className="bg-neutral-950 border-neutral-800">
            <CardHeader className="bg-neutral-900 rounded-t-2xl">
              <CardTitle className="text-neutral-100">Provider & Model</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              <div>
                <Label className="text-neutral-300">Provider</Label>
                <Select value={provider} onValueChange={(v) => setProvider(v as 'openai' | 'gemini')}>
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="gemini">Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-neutral-300">Model</Label>
                <Select value={model} onValueChange={setModel}>
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    {(provider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS).map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-neutral-300">{provider === 'openai' ? 'OpenAI API key' : 'Gemini API key'}</Label>
                <div className="flex gap-2">
                  <Input
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="sk-... or AIza..."
                    className="bg-neutral-900 border-neutral-800 text-neutral-100"
                  />
                  <Button
                    variant="secondary"
                    className="bg-purple-600 hover:bg-purple-500 text-white"
                    onClick={() => saveApiKey(provider, apiKey)}
                  >
                    Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Settings */}
          <Card className="bg-neutral-950 border-neutral-800">
            <CardHeader className="bg-neutral-900 rounded-t-2xl">
              <CardTitle className="text-neutral-100">Settings</CardTitle>
            </CardHeader>
            <CardContent className="grid md:grid-cols-3 gap-4">
              <div>
                <Label className="text-neutral-300">File type</Label>
                <Select value={fileType} onValueChange={(v) => setFileType(v as FileType)}>
                  <SelectTrigger className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
                    <SelectItem value="photo">Photo</SelectItem>
                    <SelectItem value="illustration">Illustration</SelectItem>
                    <SelectItem value="vector">Vector</SelectItem>
                    <SelectItem value="icon">Icon</SelectItem>
                    <SelectItem value="transparent_png">Transparent PNG</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-neutral-300">Title length (chars)</Label>
                <Input
                  type="number"
                  min={20}
                  max={80}
                  value={titleLength}
                  onChange={(e) => setTitleLength(parseInt(e.target.value || '60', 10))}
                  className="bg-neutral-900 border-neutral-800 text-neutral-100"
                />
              </div>
              <div>
                <Label className="text-neutral-300">Description length (words)</Label>
                <Input
                  type="number"
                  min={20}
                  max={120}
                  value={descriptionLength}
                  onChange={(e) => setDescriptionLength(parseInt(e.target.value || '60', 10))}
                  className="bg-neutral-900 border-neutral-800 text-neutral-100"
                />
              </div>
              <div>
                <Label className="text-neutral-300">Keywords count</Label>
                <Input
                  type="number"
                  min={5}
                  max={50}
                  value={keywordsCount}
                  onChange={(e) => setKeywordsCount(parseInt(e.target.value || '49', 10))}
                  className="bg-neutral-900 border-neutral-800 text-neutral-100"
                />
              </div>
              <div className="md:col-span-2">
                <Label className="text-neutral-300">Extra instructions</Label>
                <Textarea
                  rows={3}
                  value={extra}
                  onChange={(e) => setExtra(e.target.value)}
                  placeholder="Add any project-specific guidance here..."
                  className="bg-neutral-900 border-neutral-800 text-neutral-100"
                />
              </div>
            </CardContent>
          </Card>

          {/* Upload */}
          <Card onDrop={onDrop} onDragOver={(e) => e.preventDefault()} className="bg-neutral-950 border-neutral-800">
            <CardHeader className="bg-neutral-900 rounded-t-2xl">
              <CardTitle className="text-neutral-100">Upload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="border border-neutral-800 rounded-2xl p-6 text-neutral-300 text-center bg-neutral-900/50">
                Drag & drop images here or
                <div className="mt-3">
                  <FilePicker
                    onPick={(fl) => setFiles((prev) => [...prev, ...fl.filter((f) => f.type.startsWith('image/'))])}
                  />
                </div>
              </div>
              {!!files.length && (
                <div className="text-sm text-neutral-300">
                  <strong className="text-neutral-100">{files.length}</strong> file(s) selected:
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {files.map((f) => (
                      <li key={f.name}>{f.name}</li>
                    ))}
                  </ul>
                  <div className="text-xs mt-2 text-neutral-400">(Previews are hidden until metadata is generated)</div>
                </div>
              )}
              <div className="flex gap-2 items-center">
                <Button
                  disabled={!files.length || busy}
                  onClick={runGeneration}
                  className="bg-purple-600 hover:bg-purple-500 text-white"
                >
                  Generate metadata
                </Button>
                {busy && <Progress value={progress} className="w-56 bg-neutral-900" />}
                {busy && (
                  <span className="text-sm text-neutral-400">
                    {Math.round(progress)}% | {Math.round((progress / 100) * files.length)} / {files.length}
                  </span>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results (editable) */}
          {!!items.length && (
            <Card className="bg-neutral-950 border-neutral-800">
              <CardHeader className="bg-neutral-900 rounded-t-2xl">
                <CardTitle className="text-neutral-100">Results</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2 flex-wrap">
                  <Button
                    variant="secondary"
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
                    onClick={() => downloadAgencyCSV('adobe', items)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Adobe CSV
                  </Button>
                  <Button
                    variant="secondary"
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
                    onClick={() => downloadAgencyCSV('shutterstock', items)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Shutterstock CSV
                  </Button>
                  <Button
                    variant="secondary"
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
                    onClick={() => downloadAgencyCSV('vecteezy', items)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Vecteezy CSV
                  </Button>
                  <Button
                    variant="secondary"
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
                    onClick={() => downloadAgencyCSV('freepik', items)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Freepik CSV
                  </Button>
                  <Button
                    variant="secondary"
                    className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
                    onClick={() => downloadAgencyCSV('dreamstime', items)}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Dreamstime CSV
                  </Button>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {items.map((it) => (
                    <div key={it.id} className="rounded-2xl border border-neutral-800 overflow-hidden bg-neutral-900/50">
                      <div className="flex gap-3 p-3 items-center bg-gradient-to-r from-purple-950/50 to-neutral-950">
                        <div className="w-16 h-16 bg-neutral-800 rounded-lg overflow-hidden flex items-center justify-center">
                          {it.thumbDataUrl ? (
                            <Image alt="" src={it.thumbDataUrl} width={64} height={64} className="object-cover w-full h-full" unoptimized />
                          ) : (
                            <span className="text-xs text-neutral-500">No preview</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate text-neutral-100">{it.filename}</div>
                          <div className="text-xs text-neutral-400">{new Date(it.createdAt).toLocaleString()}</div>
                        </div>
                        {it.error && <Badge variant="destructive" className="ml-auto">Error</Badge>}
                      </div>

                      <div className="p-4 space-y-3 text-neutral-200">
                        {it.error ? (
                          <pre className="text-red-400 text-sm whitespace-pre-wrap">{it.error}</pre>
                        ) : (
                          <>
                            {/* Title */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-neutral-100">Title</span>
                                <div className="shrink-0 flex gap-2">
                                  <Button size="icon" variant="ghost" className="text-neutral-200" onClick={() => copy(it.meta?.title || '')} title="Copy title">
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="text-neutral-200" onClick={() => saveEdits(it.id)} title="Save edits">
                                    <Save className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="text-neutral-200" onClick={() => regenerate(it.id)} title="Regenerate">
                                    <RotateCw className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <Input
                                className="bg-neutral-900 border-neutral-700 text-neutral-100"
                                value={it.meta?.title || ''}
                                onChange={(e) => patchItemMeta(it.id, { title: e.target.value })}
                              />
                            </div>

                            {/* Description */}
                            <div className="space-y-1">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-neutral-100">Desc</span>
                                <div className="shrink-0 flex gap-2">
                                  <Button size="icon" variant="ghost" className="text-neutral-200" onClick={() => copy(it.meta?.description || '')} title="Copy description">
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="text-neutral-200" onClick={() => saveEdits(it.id)} title="Save edits">
                                    <Save className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="text-neutral-200" onClick={() => regenerate(it.id)} title="Regenerate">
                                    <RotateCw className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>
                              <Textarea
                                rows={3}
                                className="bg-neutral-900 border-neutral-700 text-neutral-100"
                                value={it.meta?.description || ''}
                                onChange={(e) => patchItemMeta(it.id, { description: e.target.value })}
                              />
                            </div>

                            {/* Keywords (chips + add box) */}
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="font-semibold text-neutral-100">Keywords</span>
                                <div className="shrink-0 flex gap-2">
                                  <Button size="icon" variant="ghost" className="text-neutral-200" onClick={() => tidyKeywords(it.id)} title="Tidy keywords">
                                    <Wand2 className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="text-neutral-200" onClick={() => copy(it.meta?.keywords || '')} title="Copy keywords">
                                    <Copy className="w-4 h-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="text-neutral-200" onClick={() => saveEdits(it.id)} title="Save edits">
                                    <Save className="w-4 h-4" />
                                  </Button>
                                </div>
                              </div>

                              {/* Chips row with drag-and-drop */}
                              <div className="flex flex-wrap gap-2">
                                {parseKeywords(it.meta?.keywords || '').map((kw, idx, arr) => (
                                  <span
                                    key={`${kw}-${idx}`}
                                    draggable
                                    onDragStart={(e) => e.dataTransfer.setData('text/plain', String(idx))}
                                    onDragOver={(e) => e.preventDefault()}
                                    onDrop={(e) => {
                                      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                                      const to = idx;
                                      onChipDrop(it.id, from, to);
                                    }}
                                    className="px-2 py-1 rounded-lg border border-purple-500/40 bg-purple-700/25 text-purple-100 text-xs select-none cursor-move"
                                    title="Drag to reorder"
                                  >
                                    {kw}
                                    <button
                                      className="ml-1 text-purple-200/70 hover:text-white"
                                      onClick={() => {
                                        const next = arr.filter((_, i) => i !== idx).join(', ');
                                        patchItemMeta(it.id, { keywords: next });
                                      }}
                                      type="button"
                                      aria-label={`remove ${kw}`}
                                    >
                                      ×
                                    </button>
                                  </span>
                                ))}
                              </div>

                              {/* Small input + plus to add a new keyword */}
                              <div className="flex items-center gap-2">
                                <Input
                                  placeholder="Add keyword"
                                  value={newKw[it.id] || ''}
                                  onChange={(e) => setNewKw((s) => ({ ...s, [it.id]: e.target.value }))}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      addKeyword(it.id);
                                    }
                                  }}
                                  className="h-8 w-48 bg-neutral-900 border-neutral-700 text-neutral-100"
                                />
                                <Button
                                  size="icon"
                                  onClick={() => addKeyword(it.id)}
                                  className="h-8 w-8 bg-purple-600 hover:bg-purple-500 text-white"
                                  title="Add keyword"
                                >
                                  <Plus className="w-4 h-4" />
                                </Button>
                                <span className="text-xs text-neutral-400 ml-2">
                                  {parseKeywords(it.meta?.keywords || '').length} keyword(s)
                                </span>
                              </div>
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

        {/* ============== HISTORY TAB ============== */}
        <TabsContent value="history" className="space-y-4">
          <Card className="bg-neutral-950 border-neutral-800">
            <CardHeader className="bg-neutral-900 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <CardTitle className="text-neutral-100">History</CardTitle>
                <div className="flex items-center gap-2 text-sm text-neutral-300">
                  <button
                    className="flex items-center gap-1 px-3 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
                    onClick={toggleSelectAll}
                  >
                    {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                    {allSelected ? 'Unselect all' : 'Select all'}
                  </button>
                  <span className="text-neutral-400">{selectedCount} selected</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {/* Export buttons */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant="secondary"
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
                  onClick={() => downloadAgencyCSV('adobe', hist.items)}
                >
                  <Download className="w-4 h-4 mr-2" /> Export page → Adobe CSV
                </Button>
                <Button
                  disabled={!selectedItems.length}
                  variant="secondary"
                  className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 disabled:opacity-50"
                  onClick={() => downloadAgencyCSV('adobe', selectedItems)}
                >
                  <Download className="w-4 h-4 mr-2" /> Export selected → Adobe CSV
                </Button>

                <Button variant="secondary" className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700" onClick={() => downloadAgencyCSV('shutterstock', hist.items)}>
                  <Download className="w-4 h-4 mr-2" /> Page → Shutterstock
                </Button>
                <Button disabled={!selectedItems.length} variant="secondary" className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 disabled:opacity-50" onClick={() => downloadAgencyCSV('shutterstock', selectedItems)}>
                  <Download className="w-4 h-4 mr-2" /> Selected → Shutterstock
                </Button>

                <Button variant="secondary" className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700" onClick={() => downloadAgencyCSV('vecteezy', hist.items)}>
                  <Download className="w-4 h-4 mr-2" /> Page → Vecteezy
                </Button>
                <Button disabled={!selectedItems.length} variant="secondary" className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 disabled:opacity-50" onClick={() => downloadAgencyCSV('vecteezy', selectedItems)}>
                  <Download className="w-4 h-4 mr-2" /> Selected → Vecteezy
                </Button>

                <Button variant="secondary" className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700" onClick={() => downloadAgencyCSV('freepik', hist.items)}>
                  <Download className="w-4 h-4 mr-2" /> Page → Freepik
                </Button>
                <Button disabled={!selectedItems.length} variant="secondary" className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 disabled:opacity-50" onClick={() => downloadAgencyCSV('freepik', selectedItems)}>
                  <Download className="w-4 h-4 mr-2" /> Selected → Freepik
                </Button>

                <Button variant="secondary" className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700" onClick={() => downloadAgencyCSV('dreamstime', hist.items)}>
                  <Download className="w-4 h-4 mr-2" /> Page → Dreamstime
                </Button>
                <Button disabled={!selectedItems.length} variant="secondary" className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 disabled:opacity-50" onClick={() => downloadAgencyCSV('dreamstime', selectedItems)}>
                  <Download className="w-4 h-4 mr-2" /> Selected → Dreamstime
                </Button>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                {hist.items.map((it) => {
                  const checked = selectedIds.has(it.id);
                  return (
                    <div
                      key={it.id}
                      className={`rounded-2xl border border-neutral-800 overflow-hidden bg-neutral-900/50 ${checked ? 'ring-2 ring-purple-500/40' : ''
                        }`}
                    >
                      <div className="flex gap-3 p-3 items-center bg-gradient-to-r from-purple-950/50 to-neutral-950">
                        <button
                          className="p-2 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
                          onClick={() => toggleSelect(it.id)}
                          aria-pressed={checked}
                        >
                          {checked ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
                        </button>
                        <div className="w-16 h-16 bg-neutral-800 rounded-lg overflow-hidden flex items-center justify-center">
                          {it.thumbDataUrl ? (
                            <Image alt="" src={it.thumbDataUrl} width={64} height={64} className="object-cover w-full h-full" unoptimized />
                          ) : (
                            <span className="text-xs text-neutral-500">No preview</span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-medium truncate text-neutral-100">{it.filename}</div>
                          <div className="text-xs text-neutral-400">{new Date(it.createdAt).toLocaleString()}</div>
                        </div>
                        {it.error && <Badge variant="destructive" className="ml-auto">Error</Badge>}
                      </div>

                      <div className="p-4 space-y-2 text-neutral-200">
                        {it.error ? (
                          <pre className="text-red-400 text-sm whitespace-pre-wrap">{it.error}</pre>
                        ) : (
                          <>
                            <div className="flex items-start gap-2">
                              <div className="font-semibold min-w-[70px] text-neutral-100">Title</div>
                              <div className="flex-1 text-neutral-200">{it.meta?.title}</div>
                              <div className="shrink-0">
                                <Button size="icon" variant="ghost" className="text-neutral-200" onClick={() => copy(it.meta?.title || '')} title="Copy title">
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="font-semibold min-w-[70px] text-neutral-100">Desc</div>
                              <div className="flex-1 text-neutral-300">{it.meta?.description}</div>
                              <div className="shrink-0">
                                <Button size="icon" variant="ghost" className="text-neutral-200" onClick={() => copy(it.meta?.description || '')} title="Copy description">
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <div className="font-semibold min-w-[70px] text-neutral-100">Keywords</div>
                              <div className="flex-1 text-neutral-300 break-words">{it.meta?.keywords}</div>
                              <div className="shrink-0">
                                <Button size="icon" variant="ghost" className="text-neutral-200" onClick={() => copy(it.meta?.keywords || '')} title="Copy keywords">
                                  <Copy className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {totalPages > 1 && (
                <div className="flex justify-center gap-2 pt-2">
                  {Array.from({ length: totalPages }).map((_, i) => (
                    <Button
                      key={i}
                      variant={i === histPage ? 'default' : 'secondary'}
                      onClick={() => setHistPage(i)}
                      className={`border ${i === histPage
                        ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-500/50'
                        : 'bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border-neutral-700'
                        }`}
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
