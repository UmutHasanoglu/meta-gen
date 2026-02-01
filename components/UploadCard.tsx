'use client';

import { memo, useId } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';
import type { Provider } from '@/lib/types';

interface UploadCardProps {
  files: File[];
  busy: boolean;
  progress: number;
  provider: Provider;
  hasVideoFiles: boolean;
  onFilesChange: (files: File[]) => void;
  onGenerate: () => void;
}

function FilePicker({ onPick }: { onPick: (files: File[]) => void }) {
  const id = useId();
  return (
    <div className="inline-flex items-center gap-2">
      <input
        id={id}
        type="file"
        accept="image/*,video/mp4,video/webm,video/quicktime"
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
        Select files
      </label>
    </div>
  );
}

function UploadCardComponent({
  files,
  busy,
  progress,
  provider,
  hasVideoFiles,
  onFilesChange,
  onGenerate,
}: UploadCardProps) {
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fl = Array.from(e.dataTransfer.files || []).filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    onFilesChange([...files, ...fl]);
  };

  const addFiles = (newFiles: File[]) => {
    const validFiles = newFiles.filter(
      (f) => f.type.startsWith('image/') || f.type.startsWith('video/')
    );
    onFilesChange([...files, ...validFiles]);
  };

  const showVideoWarning = hasVideoFiles && provider === 'openai';

  console.log('UploadCard render:', { filesLen: files.length, busy, showVideoWarning, disabled: !files.length || busy || showVideoWarning });

  return (
    <Card
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      className="bg-neutral-950 border-neutral-800"
    >
      <CardHeader className="bg-neutral-900 rounded-t-2xl">
        <CardTitle className="text-neutral-100">Upload</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="border border-neutral-800 rounded-2xl p-6 text-neutral-300 text-center bg-neutral-900/50">
          Drag & drop images or videos here, or
          <div className="mt-3">
            <FilePicker onPick={addFiles} />
          </div>
        </div>

        {showVideoWarning && (
          <Alert className="bg-yellow-900/20 border-yellow-600/50">
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
            <AlertDescription className="text-yellow-200">
              Video analysis requires Gemini. OpenAI does not support video input. Please switch to
              Gemini or remove video files.
            </AlertDescription>
          </Alert>
        )}

        {!!files.length && (
          <div className="text-sm text-neutral-300">
            <strong className="text-neutral-100">{files.length}</strong> file(s) selected:
            <ul className="list-disc list-inside mt-1 space-y-0.5 max-h-32 overflow-y-auto">
              {files.map((f, idx) => (
                <li key={`${f.name}-${idx}`} className="flex items-center gap-2">
                  <span className="truncate">{f.name}</span>
                  {f.type.startsWith('video/') && (
                    <span className="text-xs px-1.5 py-0.5 bg-purple-600/30 text-purple-200 rounded">
                      video
                    </span>
                  )}
                </li>
              ))}
            </ul>
            <div className="text-xs mt-2 text-neutral-400">
              (Previews are hidden until metadata is generated)
            </div>
          </div>
        )}

        <div className="flex gap-2 items-center">
          <Button
            disabled={!files.length || busy || showVideoWarning}
            onClick={onGenerate}
            className="bg-purple-600 hover:bg-purple-500 text-white"
          >
            Generate metadata
          </Button>
          {busy && (
            <>
              <Progress value={progress} className="w-56 bg-neutral-900" />
              <span className="text-sm text-neutral-400">
                {Math.round(progress)}% | {Math.round((progress / 100) * files.length)} /{' '}
                {files.length}
              </span>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export const UploadCard = memo(UploadCardComponent);
