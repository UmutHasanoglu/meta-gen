export type FileType = 'photo'|'illustration'|'vector'|'icon'|'transparent_png';

export interface GenSettings {
  provider: 'openai'|'gemini';
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
}

export interface ItemMetaBox {
  id: string;
  filename: string;
  fileType: FileType;
  createdAt: number;
  thumbDataUrl?: string; // added after generation
  meta?: MetaOutput;
  error?: string;
}