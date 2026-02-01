'use client';

import { memo, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Download, Search, CheckSquare, Square, Trash2 } from 'lucide-react';
import { MetadataItem } from '@/components/MetadataItem';
import { downloadAgencyCSV, type Agency } from '@/lib/csv';
import type { ItemMetaBox, MetaOutput } from '@/lib/types';

interface HistoryCardProps {
  items: ItemMetaBox[];
  total: number;
  page: number;
  pageSize: number;
  selectedIds: Set<string>;
  onPageChange: (page: number) => void;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  onDelete: (id: string) => void;
  onBulkDelete: (ids: string[]) => void;
  onPatchMeta?: (id: string, patch: Partial<MetaOutput>) => void;
  onSave?: (id: string) => void;
  onChipDrop?: (itemId: string, from: number, to: number) => void;
  editable?: boolean;
}

const AGENCIES: { key: Agency; label: string }[] = [
  { key: 'adobe', label: 'Adobe' },
  { key: 'shutterstock', label: 'Shutterstock' },
  { key: 'vecteezy', label: 'Vecteezy' },
  { key: 'freepik', label: 'Freepik' },
  { key: 'dreamstime', label: 'Dreamstime' },
];

function HistoryCardComponent({
  items,
  total,
  page,
  pageSize,
  selectedIds,
  onPageChange,
  onToggleSelect,
  onToggleSelectAll,
  onDelete,
  onBulkDelete,
  onPatchMeta,
  onSave,
  onChipDrop,
  editable = false,
}: HistoryCardProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const totalPages = Math.ceil(total / pageSize);
  const selectedCount = selectedIds.size;
  const allSelectable = items.filter((i) => !i.error);
  const allSelected = selectedCount > 0 && selectedCount === allSelectable.length;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(
      (it) =>
        it.filename.toLowerCase().includes(q) ||
        it.meta?.title?.toLowerCase().includes(q) ||
        it.meta?.keywords?.toLowerCase().includes(q)
    );
  }, [items, searchQuery]);

  const selectedItems = useMemo(
    () => items.filter((it) => selectedIds.has(it.id)),
    [items, selectedIds]
  );

  const handleBulkDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`Delete ${selectedIds.size} selected item(s)?`)) {
      onBulkDelete(Array.from(selectedIds));
    }
  };

  return (
    <Card className="bg-neutral-950 border-neutral-800">
      <CardHeader className="bg-neutral-900 rounded-t-2xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <CardTitle className="text-neutral-100">History</CardTitle>
          <div className="flex items-center gap-2 text-sm">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <Input
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 w-48 h-8 bg-neutral-800 border-neutral-700 text-neutral-100"
              />
            </div>
            {/* Select all */}
            <button
              className="flex items-center gap-1 px-3 py-1 rounded-md bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
              onClick={onToggleSelectAll}
            >
              {allSelected ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
              {allSelected ? 'Unselect all' : 'Select all'}
            </button>
            <span className="text-neutral-400">{selectedCount} selected</span>
            {/* Bulk delete */}
            {selectedCount > 0 && (
              <Button
                size="sm"
                variant="destructive"
                onClick={handleBulkDelete}
                className="h-7"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Delete
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Export buttons */}
        <div className="flex gap-2 flex-wrap">
          {AGENCIES.map(({ key, label }) => (
            <div key={key} className="flex gap-1">
              <Button
                variant="secondary"
                size="sm"
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
                onClick={() => downloadAgencyCSV(key, items)}
              >
                <Download className="w-3 h-3 mr-1" />
                Page → {label}
              </Button>
              <Button
                disabled={!selectedItems.length}
                variant="secondary"
                size="sm"
                className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700 disabled:opacity-50"
                onClick={() => downloadAgencyCSV(key, selectedItems)}
              >
                Selected → {label}
              </Button>
            </div>
          ))}
        </div>

        {/* Items grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {filteredItems.map((item) => (
            <MetadataItem
              key={item.id}
              item={item}
              editable={editable}
              selectable
              selected={selectedIds.has(item.id)}
              onSelect={onToggleSelect}
              onDelete={onDelete}
              onPatchMeta={onPatchMeta}
              onSave={onSave}
              onChipDrop={onChipDrop}
            />
          ))}
        </div>

        {filteredItems.length === 0 && searchQuery && (
          <div className="text-center text-neutral-400 py-8">
            No items match your search.
          </div>
        )}

        {filteredItems.length === 0 && !searchQuery && (
          <div className="text-center text-neutral-400 py-8">
            No history yet. Generate some metadata to see it here.
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && !searchQuery && (
          <div className="flex justify-center gap-2 pt-2">
            {Array.from({ length: totalPages }).map((_, i) => (
              <Button
                key={i}
                variant={i === page ? 'default' : 'secondary'}
                size="sm"
                onClick={() => onPageChange(i)}
                className={`border ${
                  i === page
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
  );
}

export const HistoryCard = memo(HistoryCardComponent);
