'use client';

import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Provider } from '@/lib/types';

interface ProviderCardProps {
  provider: Provider;
  model: string;
  apiKey: string;
  openaiModels: string[];
  geminiModels: string[];
  onProviderChange: (provider: Provider) => void;
  onModelChange: (model: string) => void;
  onApiKeyChange: (key: string) => void;
  onSaveApiKey: () => void;
}

function ProviderCardComponent({
  provider,
  model,
  apiKey,
  openaiModels,
  geminiModels,
  onProviderChange,
  onModelChange,
  onApiKeyChange,
  onSaveApiKey,
}: ProviderCardProps) {
  const models = provider === 'openai' ? openaiModels : geminiModels;

  return (
    <Card className="bg-neutral-950 border-neutral-800">
      <CardHeader className="bg-neutral-900 rounded-t-2xl">
        <CardTitle className="text-neutral-100">Provider & Model</CardTitle>
      </CardHeader>
      <CardContent className="grid md:grid-cols-3 gap-4">
        <div>
          <Label className="text-neutral-300">Provider</Label>
          <Select value={provider} onValueChange={(v) => onProviderChange(v as Provider)}>
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
          <Select value={model} onValueChange={onModelChange}>
            <SelectTrigger className="bg-neutral-900 border-neutral-800 text-neutral-100">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-neutral-900 border-neutral-800 text-neutral-100">
              {models.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-neutral-300">
            {provider === 'openai' ? 'OpenAI API key' : 'Gemini API key'}
          </Label>
          <div className="flex gap-2">
            <Input
              type="password"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              placeholder="sk-... or AIza..."
              className="bg-neutral-900 border-neutral-800 text-neutral-100"
            />
            <Button
              variant="secondary"
              className="bg-purple-600 hover:bg-purple-500 text-white"
              onClick={onSaveApiKey}
            >
              Save
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const ProviderCard = memo(ProviderCardComponent);
