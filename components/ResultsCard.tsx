'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';
import { MetadataItem } from '@/components/MetadataItem';
import { downloadAgencyCSV, type Agency } from '@/lib/csv';
import type { ItemMetaBox, MetaOutput } from '@/lib/types';

interface ResultsCardProps {
  items: ItemMetaBox[];
  onPatchMeta: (id: string, patch: Partial<MetaOutput>) => void;
  onSave: (id: string) => void;
  onTidy: (id: string) => void;
  onRegenerate: (id: string) => void;
  onChipDrop: (itemId: string, from: number, to: number) => void;
}

const AGENCIES: { key: Agency; label: string }[] = [
  { key: 'adobe', label: 'Adobe CSV' },
  { key: 'shutterstock', label: 'Shutterstock CSV' },
  { key: 'vecteezy', label: 'Vecteezy CSV' },
  { key: 'freepik', label: 'Freepik CSV' },
  { key: 'dreamstime', label: 'Dreamstime CSV' },
];

function ResultsCardComponent({
  items,
  onPatchMeta,
  onSave,
  onTidy,
  onRegenerate,
  onChipDrop,
}: ResultsCardProps) {
  if (!items.length) return null;

  return (
    <Card className="bg-neutral-950 border-neutral-800">
      <CardHeader className="bg-neutral-900 rounded-t-2xl">
        <CardTitle className="text-neutral-100">Results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Export buttons */}
        <div className="flex gap-2 flex-wrap">
          {AGENCIES.map(({ key, label }) => (
            <Button
              key={key}
              variant="secondary"
              className="bg-neutral-800 hover:bg-neutral-700 text-neutral-100 border border-neutral-700"
              onClick={() => downloadAgencyCSV(key, items)}
            >
              <Download className="w-4 h-4 mr-2" />
              {label}
            </Button>
          ))}
        </div>

        {/* Items grid */}
        <div className="grid md:grid-cols-2 gap-4">
          {items.map((item) => (
            <MetadataItem
              key={item.id}
              item={item}
              editable
              onPatchMeta={onPatchMeta}
              onSave={onSave}
              onTidy={onTidy}
              onRegenerate={onRegenerate}
              onChipDrop={onChipDrop}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export const ResultsCard = memo(ResultsCardComponent);
