
export interface ImageAsset {
  id: string;
  base64: string;
  mimeType: string;
  url?: string;
  selected: boolean;
  prompt?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export interface VideoAsset {
  id: string;
  imageId?: string; // Optional: undefined if generated directly from text
  status: 'pending' | 'processing' | 'completed' | 'failed';
  url?: string;
  error?: string;
  prompt?: string; // Store prompt for reference if needed
  modelUsed?: string;
  progress?: number;
}

export enum AppStep {
  INPUT = 'INPUT',
  GENERATING_IMAGES = 'GENERATING_IMAGES',
  SELECTION = 'SELECTION',
  GENERATING_VIDEOS = 'GENERATING_VIDEOS',
}

export interface VideoModel {
  id: string;
  name: string;
  provider: 'OpenAI' | 'Google' | 'Other';
  description: string;
  badge?: string;
}

// Extend Window interface for AI Studio specific API
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    aistudio?: AIStudio;
  }
}
