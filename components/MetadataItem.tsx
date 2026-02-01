'use client';

import { memo, useState } from 'react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Copy,
  RotateCw,
  Save,
  Wand2,
  Plus,
  Trash2,
  CheckSquare,
  Square,
} from 'lucide-react';
import { parseKeywords } from '@/lib/keywords';
import type { ItemMetaBox, MetaOutput } from '@/lib/types';

/* Adobe Stock category codes */
const ADOBE_STOCK_CATEGORIES = [
  { code: '1', name: 'Animals' },
  { code: '2', name: 'Buildings and Architecture' },
  { code: '3', name: 'Business' },
  { code: '4', name: 'Drinks' },
  { code: '5', name: 'The Environment' },
  { code: '6', name: 'States of Mind' },
  { code: '7', name: 'Food' },
  { code: '8', name: 'Graphic Resources' },
  { code: '9', name: 'Hobbies and Leisure' },
  { code: '10', name: 'Industry' },
  { code: '11', name: 'Landscapes' },
  { code: '12', name: 'Lifestyle' },
  { code: '13', name: 'People' },
  { code: '14', name: 'Plants and Flowers' },
  { code: '15', name: 'Culture and Religion' },
  { code: '16', name: 'Science' },
  { code: '17', name: 'Social Issues' },
  { code: '18', name: 'Sports' },
  { code: '19', name: 'Technology' },
  { code: '20', name: 'Transport' },
  { code: '21', name: 'Travel' },
] as const;

interface MetadataItemProps {
  item: ItemMetaBox;
  editable?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onPatchMeta?: (id: string, patch: Partial<MetaOutput>) => void;
  onSave?: (id: string) => void;
  onTidy?: (id: string) => void;
  onRegenerate?: (id: string) => void;
  onDelete?: (id: string) => void;
  onChipDrop?: (itemId: string, from: number, to: number) => void;
}

function MetadataItemComponent({
  item,
  editable = false,
  selectable = false,
  selected = false,
  onSelect,
  onPatchMeta,
  onSave,
  onTidy,
  onRegenerate,
  onDelete,
  onChipDrop,
}: MetadataItemProps) {
  const [newKw, setNewKw] = useState('');

  const copy = (text: string) => {
    void navigator.clipboard.writeText(text || '');
  };

  const addKeyword = () => {
    const kw = newKw.trim();
    if (!kw || !onPatchMeta) return;
    const arr = parseKeywords(item.meta?.keywords || '');
    const lower = new Set(arr.map((s) => s.toLowerCase()));
    if (lower.has(kw.toLowerCase())) {
      setNewKw('');
      return;
    }
    arr.push(kw);
    onPatchMeta(item.id, { keywords: arr.join(', ') });
    setNewKw('');
  };

  const removeKeyword = (idx: number) => {
    if (!onPatchMeta) return;
    const arr = parseKeywords(item.meta?.keywords || '');
    const next = arr.filter((_, i) => i !== idx).join(', ');
    onPatchMeta(item.id, { keywords: next });
  };

  const isVideo = item.assetType === 'video';

  return (
    <div
      className={`rounded-2xl border border-neutral-800 overflow-hidden bg-neutral-900/50 ${
        selected ? 'ring-2 ring-purple-500/40' : ''
      }`}
    >
      {/* Header with thumbnail */}
      <div className="flex gap-3 p-3 items-center bg-gradient-to-r from-purple-950/50 to-neutral-950">
        {selectable && onSelect && (
          <button
            className="p-2 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
            onClick={() => onSelect(item.id)}
            aria-pressed={selected}
            aria-label={selected ? 'Deselect item' : 'Select item'}
          >
            {selected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
          </button>
        )}
        <div className="w-16 h-16 bg-neutral-800 rounded-lg overflow-hidden flex items-center justify-center">
          {isVideo && item.videoDataUrl ? (
            <video
              src={item.videoDataUrl}
              className="object-cover w-full h-full"
              muted
              playsInline
            />
          ) : item.thumbDataUrl ? (
            <Image
              alt=""
              src={item.thumbDataUrl}
              width={64}
              height={64}
              className="object-cover w-full h-full"
              unoptimized
            />
          ) : (
            <span className="text-xs text-neutral-500">No preview</span>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-medium truncate text-neutral-100">{item.filename}</div>
          <div className="text-xs text-neutral-400">
            {new Date(item.createdAt).toLocaleString()}
            {isVideo && item.videoDuration && ` • ${Math.round(item.videoDuration)}s`}
          </div>
        </div>
        {item.error && <Badge variant="destructive" className="ml-auto">Error</Badge>}
        {onDelete && (
          <Button
            size="icon"
            variant="ghost"
            className="text-neutral-400 hover:text-red-400"
            onClick={() => onDelete(item.id)}
            aria-label="Delete item"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3 text-neutral-200">
        {item.error ? (
          <pre className="text-red-400 text-sm whitespace-pre-wrap">{item.error}</pre>
        ) : editable ? (
          <>
            {/* Title (editable) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-100">Title</span>
                <div className="shrink-0 flex gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-neutral-200"
                    onClick={() => copy(item.meta?.title || '')}
                    aria-label="Copy title"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                  {onSave && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-neutral-200"
                      onClick={() => onSave(item.id)}
                      aria-label="Save edits"
                    >
                      <Save className="w-4 h-4" />
                    </Button>
                  )}
                  {onRegenerate && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-neutral-200"
                      onClick={() => onRegenerate(item.id)}
                      aria-label="Regenerate metadata"
                    >
                      <RotateCw className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
              <Input
                className="bg-neutral-900 border-neutral-700 text-neutral-100"
                value={item.meta?.title || ''}
                onChange={(e) => onPatchMeta?.(item.id, { title: e.target.value })}
              />
            </div>

            {/* Description (editable) */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-100">Description</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="text-neutral-200"
                  onClick={() => copy(item.meta?.description || '')}
                  aria-label="Copy description"
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <Textarea
                rows={3}
                className="bg-neutral-900 border-neutral-700 text-neutral-100"
                value={item.meta?.description || ''}
                onChange={(e) => onPatchMeta?.(item.id, { description: e.target.value })}
              />
            </div>

            {/* Adobe Stock fields */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <span className="font-semibold text-neutral-100 text-sm">Category</span>
                <Select
                  value={item.meta?.category || 'none'}
                  onValueChange={(value) => onPatchMeta?.(item.id, { category: value === 'none' ? '' : value })}
                >
                  <SelectTrigger className="bg-neutral-900 border-neutral-700 text-neutral-100">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent className="bg-neutral-900 border-neutral-700 text-neutral-100 max-h-64">
                    <SelectItem value="none">None</SelectItem>
                    {ADOBE_STOCK_CATEGORIES.map((cat) => (
                      <SelectItem key={cat.code} value={cat.code}>
                        {cat.code}. {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="font-semibold text-neutral-100 text-sm">Releases</span>
                <Input
                  className="bg-neutral-900 border-neutral-700 text-neutral-100"
                  value={item.meta?.releases || ''}
                  onChange={(e) => onPatchMeta?.(item.id, { releases: e.target.value })}
                  placeholder="Model/property releases"
                />
              </div>
            </div>

            {/* Keywords (chips + add box) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-neutral-100">Keywords</span>
                <div className="shrink-0 flex gap-2">
                  {onTidy && (
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-neutral-200"
                      onClick={() => onTidy(item.id)}
                      aria-label="Tidy keywords"
                    >
                      <Wand2 className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="text-neutral-200"
                    onClick={() => copy(item.meta?.keywords || '')}
                    aria-label="Copy keywords"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Draggable chips */}
              <div className="flex flex-wrap gap-2">
                {parseKeywords(item.meta?.keywords || '').map((kw, idx) => (
                  <span
                    key={`${kw}-${idx}`}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData('text/plain', String(idx))}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                      onChipDrop?.(item.id, from, idx);
                    }}
                    className="px-2 py-1 rounded-lg border border-purple-500/40 bg-purple-700/25 text-purple-100 text-xs select-none cursor-move"
                  >
                    {kw}
                    <button
                      className="ml-1 text-purple-200/70 hover:text-white"
                      onClick={() => removeKeyword(idx)}
                      type="button"
                      aria-label={`Remove ${kw}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>

              {/* Add keyword input */}
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Add keyword"
                  value={newKw}
                  onChange={(e) => setNewKw(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addKeyword();
                    }
                  }}
                  className="h-8 w-48 bg-neutral-900 border-neutral-700 text-neutral-100"
                />
                <Button
                  size="icon"
                  onClick={addKeyword}
                  className="h-8 w-8 bg-purple-600 hover:bg-purple-500 text-white"
                  aria-label="Add keyword"
                >
                  <Plus className="w-4 h-4" />
                </Button>
                <span className="text-xs text-neutral-400 ml-2">
                  {parseKeywords(item.meta?.keywords || '').length} keyword(s)
                </span>
              </div>
            </div>
          </>
        ) : (
          /* Read-only view */
          <>
            <div className="flex items-start gap-2">
              <div className="font-semibold min-w-[70px] text-neutral-100">Title</div>
              <div className="flex-1 text-neutral-200">{item.meta?.title}</div>
              <Button
                size="icon"
                variant="ghost"
                className="text-neutral-200 shrink-0"
                onClick={() => copy(item.meta?.title || '')}
                aria-label="Copy title"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-start gap-2">
              <div className="font-semibold min-w-[70px] text-neutral-100">Desc</div>
              <div className="flex-1 text-neutral-300">{item.meta?.description}</div>
              <Button
                size="icon"
                variant="ghost"
                className="text-neutral-200 shrink-0"
                onClick={() => copy(item.meta?.description || '')}
                aria-label="Copy description"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex items-start gap-2">
              <div className="font-semibold min-w-[70px] text-neutral-100">Keywords</div>
              <div className="flex-1 text-neutral-300 break-words">{item.meta?.keywords}</div>
              <Button
                size="icon"
                variant="ghost"
                className="text-neutral-200 shrink-0"
                onClick={() => copy(item.meta?.keywords || '')}
                aria-label="Copy keywords"
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export const MetadataItem = memo(MetadataItemComponent);
