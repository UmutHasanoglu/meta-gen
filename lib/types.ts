export type FileType = 'photo'|'illustration'|'vector'|'icon'|'transparent_png'|'video';
export type AssetType = 'image' | 'video';
export type Provider = 'openai' | 'gemini';

export interface GenSettings {
  provider: Provider;
  model: string;
  fileType: FileType;
  titleLength: number;           // characters
  descriptionLength: number;     // words
  keywordsCount: number;         // exact count
  extraInstructions: string;
}

export interface MetaOutput {
  title: string;
  description: string;
  keywords: string; // comma-separated
  category?: string;   // Adobe Stock category
  releases?: string;   // Adobe Stock releases
}

export interface ItemMetaBox {
  id: string;
  filename: string;
  fileType: FileType;
  assetType: AssetType;
  createdAt: number;
  thumbDataUrl?: string; // added after generation
  videoDataUrl?: string; // for video files
  videoDuration?: number; // in seconds
  meta?: MetaOutput;
  error?: string;
}
