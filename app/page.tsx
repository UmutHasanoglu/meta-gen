'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ImageIcon, History as HistoryIcon } from 'lucide-react';
import { nanoid } from 'nanoid/non-secure';

import { ProviderCard } from '@/components/ProviderCard';
import { SettingsCard } from '@/components/SettingsCard';
import { UploadCard } from '@/components/UploadCard';
import { ResultsCard } from '@/components/ResultsCard';
import { HistoryCard } from '@/components/HistoryCard';

import { resizeImageToMax1024 } from '@/lib/resize';
import { sha256 } from '@/lib/hash';
import { cleanKeywords, parseKeywords } from '@/lib/keywords';
import {
  saveHistoryItem,
  loadHistory,
  deleteHistoryItem,
  deleteHistoryItems,
  saveApiKey,
  getApiKey,
  saveSettings,
  loadSettings,
} from '@/lib/store';
import type { FileType, ItemMetaBox, MetaOutput, Provider } from '@/lib/types';

/* ---------- constants ---------- */
const OPENAI_MODELS = ['gpt-5.2', 'gpt-5.1', 'gpt-5', 'o4-mini', 'o3', 'o3-mini', 'gpt-4o', 'gpt-4.1'];
const GEMINI_MODELS = [
  'gemini-3-pro-preview',
  'gemini-3-flash-preview',
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
];

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

/* ---------- helpers ---------- */
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

/* ============================== PAGE ============================== */
export default function App() {
  // Provider & API key state
  const [provider, setProvider] = useState<Provider>('gemini');
  const [model, setModel] = useState(GEMINI_MODELS[0]);
  const [apiKey, setApiKey] = useState('');

  // Settings state
  const [fileType, setFileType] = useState<FileType>('photo');
  const [titleLength, setTitleLength] = useState(70);
  const [descriptionLength, setDescriptionLength] = useState(60);
  const [keywordsCount, setKeywordsCount] = useState(35);
  const [extra, setExtra] = useState('');

  // Files & generation state
  const [files, setFiles] = useState<File[]>([]);
  const [items, setItems] = useState<ItemMetaBox[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);

  // Tab & history state
  const [tab, setTab] = useState<'generate' | 'history'>('generate');
  const [histPage, setHistPage] = useState(0);
  const pageSize = 100;
  const [hist, setHist] = useState<{ items: ItemMetaBox[]; total: number }>({ items: [], total: 0 });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Load saved settings on mount
  useEffect(() => {
    const saved = loadSettings();
    if (saved) {
      setProvider(saved.provider);
      setModel(saved.model);
      setFileType(saved.fileType);
      setTitleLength(saved.titleLength);
      setDescriptionLength(saved.descriptionLength);
      setKeywordsCount(saved.keywordsCount);
      setExtra(saved.extraInstructions);
    }
    setApiKey(getApiKey(saved?.provider || 'gemini'));
  }, []);

  // Update API key when provider changes
  useEffect(() => {
    setApiKey(getApiKey(provider));
    const currentModels = provider === 'openai' ? OPENAI_MODELS : GEMINI_MODELS;
    if (!currentModels.includes(model)) {
      setModel(currentModels[0]);
    }
  }, [provider, model]);

  // Save settings when they change
  useEffect(() => {
    saveSettings({
      provider,
      model,
      fileType,
      titleLength,
      descriptionLength,
      keywordsCount,
      extraInstructions: extra,
    });
  }, [provider, model, fileType, titleLength, descriptionLength, keywordsCount, extra]);

  // Refresh history
  const refreshHistory = useCallback(async () => {
    const h = await loadHistory(histPage, pageSize);
    setHist(h);
    setSelectedIds(new Set());
  }, [histPage]);

  useEffect(() => {
    if (tab === 'history') void refreshHistory();
  }, [tab, refreshHistory]);

  // Check if any files are videos
  const hasVideoFiles = useMemo(
    () => files.some((f) => f.type.startsWith('video/')),
    [files]
  );

  // Generation handler
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
      const isVideo = file.type.startsWith('video/');

      try {
        let dataUrl: string;
        let videoDuration: number | undefined;

        if (isVideo) {
          // For videos, we need to use the Gemini video API
          dataUrl = await fileToDataUrl(file);
          videoDuration = await getVideoDuration(file);
        } else {
          const resized = await resizeImageToMax1024(file);
          dataUrl = resized.dataUrl;
        }

        const body = { apiKey, model, instruction: instr, instructionHash, imageDataUrl: dataUrl };
        const url = isVideo
          ? '/api/generate/gemini-video'
          : provider === 'openai'
            ? '/api/generate/openai'
            : '/api/generate/gemini';

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
          fileType: isVideo ? 'video' : fileType,
          assetType: isVideo ? 'video' : 'image',
          createdAt: Date.now(),
          thumbDataUrl: isVideo ? undefined : dataUrl,
          videoDataUrl: isVideo ? dataUrl : undefined,
          videoDuration,
          meta: fixed,
        };
        await saveHistoryItem(box);
        return box;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        const box: ItemMetaBox = {
          id: nanoid(),
          filename: file.name,
          fileType: isVideo ? 'video' : fileType,
          assetType: isVideo ? 'video' : 'image',
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

  /* ----- item helpers ----- */
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
    setItems((prev) => prev.map((i) => (i.id === id ? next : i)));
    await saveHistoryItem(next);
  }

  function onChipDrop(itemId: string, from: number, to: number) {
    const it = items.find((x) => x.id === itemId);
    if (!it?.meta) return;
    const arr = parseKeywords(it.meta.keywords);
    if (from < 0 || from >= arr.length || to < 0 || to >= arr.length) return;
    const [moved] = arr.splice(from, 1);
    arr.splice(to, 0, moved);
    patchItemMeta(itemId, { keywords: arr.join(', ') });
  }

  async function regenerate(id: string) {
    const it = items.find((x) => x.id === id);
    if (!it?.thumbDataUrl && !it?.videoDataUrl) return;
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
      const dataUrl = it.videoDataUrl || it.thumbDataUrl!;
      const isVideo = it.assetType === 'video';

      const body = { apiKey, model, instruction: instr, instructionHash, imageDataUrl: dataUrl };
      const url = isVideo
        ? '/api/generate/gemini-video'
        : provider === 'openai' ? '/api/generate/openai' : '/api/generate/gemini';

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
      setItems((prev) => prev.map((i) => (i.id === id ? updated : i)));
      await saveHistoryItem(updated);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, error: msg } : i)));
    } finally {
      setBusy(false);
    }
  }

  /* ----- history handlers ----- */
  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const allSelectable = hist.items.filter((i) => !i.error);
    const allSelected = selectedIds.size === allSelectable.length && selectedIds.size > 0;
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allSelectable.map((i) => i.id)));
    }
  }

  async function handleDeleteHistoryItem(id: string) {
    await deleteHistoryItem(id);
    await refreshHistory();
  }

  async function handleBulkDelete(ids: string[]) {
    await deleteHistoryItems(ids);
    await refreshHistory();
  }

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

        <TabsContent value="generate" className="space-y-6">
          <ProviderCard
            provider={provider}
            model={model}
            apiKey={apiKey}
            openaiModels={OPENAI_MODELS}
            geminiModels={GEMINI_MODELS}
            onProviderChange={setProvider}
            onModelChange={setModel}
            onApiKeyChange={setApiKey}
            onSaveApiKey={() => saveApiKey(provider, apiKey)}
          />

          <SettingsCard
            fileType={fileType}
            titleLength={titleLength}
            descriptionLength={descriptionLength}
            keywordsCount={keywordsCount}
            extra={extra}
            onFileTypeChange={setFileType}
            onTitleLengthChange={setTitleLength}
            onDescriptionLengthChange={setDescriptionLength}
            onKeywordsCountChange={setKeywordsCount}
            onExtraChange={setExtra}
          />

          <UploadCard
            files={files}
            busy={busy}
            progress={progress}
            provider={provider}
            hasVideoFiles={hasVideoFiles}
            onFilesChange={setFiles}
            onGenerate={runGeneration}
          />

          <ResultsCard
            items={items}
            onPatchMeta={patchItemMeta}
            onSave={saveEdits}
            onTidy={tidyKeywords}
            onRegenerate={regenerate}
            onChipDrop={onChipDrop}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4">
          <HistoryCard
            items={hist.items}
            total={hist.total}
            page={histPage}
            pageSize={pageSize}
            selectedIds={selectedIds}
            onPageChange={setHistPage}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            onDelete={handleDeleteHistoryItem}
            onBulkDelete={handleBulkDelete}
            editable
            onPatchMeta={patchItemMeta}
            onSave={saveEdits}
            onChipDrop={onChipDrop}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ---------- utility functions ---------- */
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getVideoDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(video.src);
      resolve(video.duration);
    };
    video.onerror = () => resolve(0);
    video.src = URL.createObjectURL(file);
  });
}
