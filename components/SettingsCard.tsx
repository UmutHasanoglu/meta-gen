'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { FileType } from '@/lib/types';

interface SettingsCardProps {
  fileType: FileType;
  titleLength: number;
  descriptionLength: number;
  keywordsCount: number;
  extra: string;
  onFileTypeChange: (type: FileType) => void;
  onTitleLengthChange: (length: number) => void;
  onDescriptionLengthChange: (length: number) => void;
  onKeywordsCountChange: (count: number) => void;
  onExtraChange: (extra: string) => void;
}

function SettingsCardComponent({
  fileType,
  titleLength,
  descriptionLength,
  keywordsCount,
  extra,
  onFileTypeChange,
  onTitleLengthChange,
  onDescriptionLengthChange,
  onKeywordsCountChange,
  onExtraChange,
}: SettingsCardProps) {
  return (
    <Card className="bg-neutral-950 border-neutral-800">
      <CardHeader className="bg-neutral-900 rounded-t-2xl">
        <CardTitle className="text-neutral-100">Settings</CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-3 gap-4">
        <div>
          <Label className="text-neutral-300">File type</Label>
          <Select value={fileType} onValueChange={(v) => onFileTypeChange(v as FileType)}>
            <SelectTrigger className="bg-neutral-900 border-neutral-800 text-neutral-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
              <SelectItem value="photo">Photo</SelectItem>
              <SelectItem value="illustration">Illustration</SelectItem>
              <SelectItem value="vector">Vector</SelectItem>
              <SelectItem value="icon">Icon</SelectItem>
              <SelectItem value="transparent_png">Transparent PNG</SelectItem>
              <SelectItem value="video">Video</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-neutral-300">Title length (chars)</Label>
          <Input
            type="number"
            min={20}
            max={200}
            value={titleLength}
            onChange={(e) => onTitleLengthChange(parseInt(e.target.value || '70', 10))}
            className="bg-neutral-900 border-neutral-800 text-neutral-100"
          />
        </div>
        <div>
          <Label className="text-neutral-300">Description length (words)</Label>
          <Input
            type="number"
            min={20}
            max={200}
            value={descriptionLength}
            onChange={(e) => onDescriptionLengthChange(parseInt(e.target.value || '60', 10))}
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
            onChange={(e) => onKeywordsCountChange(parseInt(e.target.value || '35', 10))}
            className="bg-neutral-900 border-neutral-800 text-neutral-100"
          />
        </div>
        <div className="md:col-span-2">
          <Label className="text-neutral-300">Extra instructions</Label>
          <Textarea
            rows={3}
            value={extra}
            onChange={(e) => onExtraChange(e.target.value)}
            placeholder="Add any project-specific guidance here..."
            className="bg-neutral-900 border-neutral-800 text-neutral-100"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export const SettingsCard = memo(SettingsCardComponent);
