'use client';

import React, { useState, useEffect, useRef } from 'react';
import JSZip from 'jszip';
import { Header } from '../components/Header';
import { LoadingBar } from '../components/LoadingBar';
import { ModelSelector } from '../components/ModelSelector';
import { ApiKeyModal } from '../components/ApiKeyModal';
import { AppStep, ImageAsset, VideoAsset, VideoModel } from '../types';
import { generateBatchImages, checkApiKey, setApiKey, generateVideoFromImage, generateVideoFromText, resetApiKey, uploadImageToAzure } from '../services/geminiService';

// Define the available models based on user request (Sora, NanoBanana, Veo)
const AVAILABLE_MODELS: VideoModel[] = [
  {
    id: 'veo3.1-pro',
    name: 'Veo 3.1 Pro',
    provider: 'Google',
    description: 'High-definition video generation with cinematic quality. Supports start/end frames.',
    badge: 'Pro'
  },
  {
    id: 'veo3.1-fast',
    name: 'Veo 3.1 Fast',
    provider: 'Google',
    description: 'Optimized for speed. Good for quick drafts and iterations.',
    badge: 'Fast'
  },
  {
    id: 'sora-2.0',
    name: 'Sora 2.0',
    provider: 'OpenAI',
    description: 'Latest Sora model. Supports Remix and character creation.',
    badge: 'New'
  },
  {
    id: 'nano-banana-pro',
    name: 'NanoBanana Pro',
    provider: 'Google',
    description: 'High quality image generation, great for storyboards.',
    badge: 'Image'
  },
  {
    id: 'nano-banana-fast',
    name: 'NanoBanana Fast',
    provider: 'Google',
    description: 'Fastest version of Nano Banana.',
    badge: 'Fast'
  },
  {
    id: 'nano-banana',
    name: 'NanoBanana Standard',
    provider: 'Google',
    description: 'Standard version of Nano Banana.',
    badge: 'Image'
  },
  {
    id: 'nano-banana-pro-vt',
    name: 'NanoBanana Pro VT',
    provider: 'Google',
    description: 'Pro VT version for advanced consistency.',
    badge: 'Pro'
  },
  {
    id: 'nano-banana-pro-cl',
    name: 'NanoBanana Pro CL',
    provider: 'Google',
    description: 'Pro CL version with custom styles.',
    badge: 'Pro'
  },
  {
    id: 'nano-banana-pro-vip',
    name: 'NanoBanana Pro VIP',
    provider: 'Google',
    description: 'High priority VIP generation.',
    badge: 'VIP'
  },
  {
    id: 'nano-banana-pro-4k-vip',
    name: 'NanoBanana Pro 4K VIP',
    provider: 'Google',
    description: 'Ultra HD 4K generation for VIPs.',
    badge: '4K'
  },
  {
    id: 'gpt-image-1.5',
    name: 'GPT Image 1.5',
    provider: 'OpenAI',
    description: 'Advanced image generation with strong consistency and editing.',
    badge: 'New'
  },
  {
    id: 'sora-image',
    name: 'Sora Image',
    provider: 'OpenAI',
    description: 'Sora based image generation for high cinematic quality.',
    badge: 'New'
  }
];

export default function Home() {
  const [step, setStep] = useState<AppStep>(AppStep.INPUT);
  const [prompt, setPrompt] = useState<string>('');
  const [videoPrompt, setVideoPrompt] = useState<string>('');
  const [selectedModelId, setSelectedModelId] = useState<string>('nano-banana-pro');
  const [selectedVideoModelId, setSelectedVideoModelId] = useState<string>('sora-2.0');
  const [videoAspectRatio, setVideoAspectRatio] = useState<string>('16:9');
  const [imageCount, setImageCount] = useState<number>(4);
  const [imageSize, setImageSize] = useState<string>('1:1');
  const [nanoAspectRatio, setNanoAspectRatio] = useState<string>('auto');
  const [nanoResolution, setNanoResolution] = useState<string>('1K');
  
  // Categorize models for easier filtering
  const IMAGE_MODELS = AVAILABLE_MODELS.filter(m => 
    m.id.includes('nano-banana') || m.id.includes('gpt-image') || m.id.includes('sora-image')
  );
  
  const VIDEO_MODELS = AVAILABLE_MODELS.filter(m => 
    m.id.includes('veo') || m.id.includes('sora-2')
  );

  const [images, setImages] = useState<ImageAsset[]>([]);
  const [videos, setVideos] = useState<VideoAsset[]>([]);
  
  // Progress states
  const [imageProgress, setImageProgress] = useState<number>(0);
  const [generatingVideosCount, setGeneratingVideosCount] = useState<{current: number, total: number}>({ current: 0, total: 0 });

  // API Key Modal State
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleReset = () => {
    setStep(AppStep.INPUT);
    setImages([]);
    setVideos([]);
    setPrompt('');
    setVideoPrompt('');
    setImageProgress(0);
  };

  const handleResetApiKey = () => {
    if (confirm("Are you sure you want to reset your API Key?")) {
      resetApiKey();
      setIsApiKeyModalOpen(true);
    }
  };

  const handleSaveApiKey = (key: string) => {
    setApiKey(key);
    if (pendingAction) {
      pendingAction();
      setPendingAction(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      const newImages: ImageAsset[] = await Promise.all(
        Array.from(files).map(async (file) => {
          return new Promise<ImageAsset>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
              const base64data = reader.result as string;
              const parts = base64data.split(',');
              resolve({
                id: crypto.randomUUID(),
                base64: parts.length > 1 ? parts[1] : base64data,
                mimeType: file.type,
                selected: true,
                prompt: prompt || ''
              });
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
          });
        })
      );

      setImages(prev => [...prev, ...newImages]);
      if (prompt) setVideoPrompt(prompt);
      setStep(AppStep.SELECTION);
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error("Failed to upload images:", error);
      alert("Failed to upload images. Please try again.");
    }
  };

  const [isDownloading, setIsDownloading] = useState(false);

  const handleBatchDownload = async () => {
    const completedVideos = videos.filter(v => v.status === 'completed' && v.url);
    if (completedVideos.length === 0) return;

    setIsDownloading(true);
    const zip = new JSZip();
    const folder = zip.folder("generated_videos");

    try {
      const downloadPromises = completedVideos.map(async (vid, index) => {
        try {
          const response = await fetch(vid.url!);
          const blob = await response.blob();
          const fileName = `video_${index + 1}.mp4`;
          folder?.file(fileName, blob);
        } catch (err) {
          console.error(`Failed to download video ${index + 1}:`, err);
        }
      });

      await Promise.all(downloadPromises);

      const content = await zip.generateAsync({ type: "blob" });
      const url = window.URL.createObjectURL(content);
      const link = document.createElement('a');
      link.href = url;
      link.download = `story_videos_${new Date().getTime()}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Batch download failed:', err);
      alert('Batch download failed, please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  // 1. Generate Images Handler
  const handleGenerateImages = async () => {
    if (!prompt.trim()) return;

    if (!checkApiKey()) {
      setPendingAction(() => handleGenerateImages);
      setIsApiKeyModalOpen(true);
      return;
    }

    try {
      setStep(AppStep.GENERATING_IMAGES);
      setImageProgress(5); 
      setImages([]); // Clear previous images

      const currentAspectRatioOrSize = selectedModelId.includes('nano-banana') ? nanoAspectRatio : imageSize;
      const currentResolution = selectedModelId.includes('nano-banana') ? nanoResolution : '1K';

      await generateBatchImages(prompt, imageCount, (update) => {
        if (typeof update === 'number') {
          setImageProgress(Math.min(100, Math.round((update / imageCount) * 100)));
          return;
        }

        setImages(prev => {
          const index = prev.findIndex(img => img.id === update.id);
          if (index >= 0) {
            const newImages = [...prev];
            newImages[index] = { ...newImages[index], ...update };
            return newImages;
          } else if (update.id) {
            return [...prev, {
              id: update.id,
              base64: '',
              mimeType: 'image/png',
              selected: true,
              prompt: prompt,
              ...update
            } as ImageAsset];
          }
          return prev;
        });
      }, selectedModelId, currentAspectRatioOrSize, currentResolution);

      setVideoPrompt(prompt);
      setStep(AppStep.SELECTION);
    } catch (error) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : "Failed to generate images. Please try again.";
      alert(errorMessage);
      setStep(AppStep.INPUT);
    }
  };

  // 1b. Direct Text-to-Video Handler
  const handleDirectVideoGeneration = async () => {
    if (!prompt.trim()) return;

    if (!checkApiKey()) {
      setPendingAction(() => handleDirectVideoGeneration);
      setIsApiKeyModalOpen(true);
      return;
    }

    try {
      setStep(AppStep.GENERATING_VIDEOS);
      
      const newVideoId = crypto.randomUUID();
      const newVideo: VideoAsset = {
        id: newVideoId,
        status: 'processing', // Start immediately as processing
        prompt: prompt,
        modelUsed: selectedModelId,
        progress: 0
      };
      
      setVideos([newVideo]);
      setGeneratingVideosCount({ current: 0, total: 1 });

      try {
        const videoUrl = await generateVideoFromText(prompt, selectedModelId, (prog) => {
          setVideos(prev => prev.map(v => v.id === newVideoId ? { ...v, progress: prog } : v));
        }, videoAspectRatio);
        setVideos(prev => prev.map(v => v.id === newVideoId ? { ...v, status: 'completed', url: videoUrl, progress: 100 } : v));
      } catch (err) {
        setVideos(prev => prev.map(v => v.id === newVideoId ? { 
          ...v, 
          status: 'failed', 
          error: err instanceof Error ? err.message : 'Generation failed' 
        } : v));
      }
      
      setGeneratingVideosCount({ current: 1, total: 1 });

    } catch (error) {
      console.error(error);
      alert("Failed to initiate video generation.");
      setStep(AppStep.INPUT);
    }
  };

  // 2. Selection Handler
  const toggleImageSelection = (id: string) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, selected: !img.selected } : img
    ));
  };

  const updateImagePrompt = (id: string, newPrompt: string) => {
    setImages(prev => prev.map(img => 
      img.id === id ? { ...img, prompt: newPrompt } : img
    ));
  };

  const deleteImage = (id: string) => {
    setImages(prev => prev.filter(img => img.id !== id));
  };

  const selectedCount = images.filter(i => i.selected).length;

  // 3. Generate Videos (from Images) Handler
  const handleGenerateVideosFromImages = async () => {
    const selectedImages = images.filter(i => i.selected);
    if (selectedImages.length === 0) return;

    setStep(AppStep.GENERATING_VIDEOS);
    
    // Initialize video placeholders
    const newVideos: VideoAsset[] = selectedImages.map(img => ({
      id: crypto.randomUUID(),
      imageId: img.id,
      status: 'pending',
      prompt: img.prompt || videoPrompt,
      modelUsed: selectedVideoModelId,
      progress: 0
    }));
    setVideos(newVideos);
    setGeneratingVideosCount({ current: 0, total: newVideos.length });

    // Start all generations in parallel
    const generationPromises = newVideos.map(async (vid) => {
      const img = selectedImages.find(i => i.id === vid.imageId);
      if (!img) return;

      setVideos(prev => prev.map(v => v.id === vid.id ? { ...v, status: 'processing' } : v));

      try {
        // 1. Ensure image has a URL (upload to Azure if it's local/base64 only)
        let imageUrl = img.url;
        if (!imageUrl) {
          try {
            setVideos(prev => prev.map(v => v.id === vid.id ? { ...v, progress: 10 } : v));
            imageUrl = await uploadImageToAzure(img.base64, img.mimeType);
            setVideos(prev => prev.map(v => v.id === vid.id ? { ...v, progress: 30 } : v));
            // Update the image asset with the new URL for future use
            setImages(prev => prev.map(i => i.id === img.id ? { ...i, url: imageUrl } : i));
          } catch (uploadError) {
            console.error("Failed to upload image to Azure:", uploadError);
            throw new Error("Failed to upload image to Azure storage.");
          }
        }

        // 2. Generate video using the URL
        const currentPrompt = img.prompt || videoPrompt;
        const videoUrl = await generateVideoFromImage(currentPrompt, imageUrl, selectedVideoModelId, (prog) => {
          const adjustedProg = 30 + (prog * 0.7);
          setVideos(prev => prev.map(v => v.id === vid.id ? { ...v, progress: Math.round(adjustedProg) } : v));
        }, videoAspectRatio);
        setVideos(prev => prev.map(v => v.id === vid.id ? { ...v, status: 'completed', url: videoUrl, progress: 100 } : v));
      } catch (err) {
        setVideos(prev => prev.map(v => v.id === vid.id ? { ...v, status: 'failed', error: err instanceof Error ? err.message : 'Generation failed' } : v));
      } finally {
        setGeneratingVideosCount(prev => ({ ...prev, current: prev.current + 1 }));
      }
    });

    await Promise.allSettled(generationPromises);
  };

  // Find the current model object for display
  const currentModel = AVAILABLE_MODELS.find(m => m.id === selectedModelId);
  const currentVideoModel = AVAILABLE_MODELS.find(m => m.id === selectedVideoModelId);

  return (
    <div className="min-h-screen pb-20">
      <Header currentStep={step} onReset={handleReset} onResetApiKey={handleResetApiKey} />

      <ApiKeyModal 
        isOpen={isApiKeyModalOpen} 
        onClose={() => setIsApiKeyModalOpen(false)} 
        onSave={handleSaveApiKey} 
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Hidden file input for uploading images */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageUpload}
          accept="image/*"
          multiple
          className="hidden"
        />
        
        {/* STEP 1: INPUT */}
        {step === AppStep.INPUT && (
          <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-8 animate-in fade-in duration-500">
            <div className="text-center space-y-4 max-w-2xl">
              <h2 className="text-4xl md:text-5xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-b from-white to-slate-400">
                Turn your story into motion.
              </h2>
              <p className="text-lg text-slate-400">
                Generate a storyboard of images first, or create a video directly from your text.
              </p>
            </div>

            <div className="w-full max-w-3xl space-y-6">
              
              <ModelSelector 
                models={AVAILABLE_MODELS} 
                selectedModelId={selectedModelId} 
                onSelect={setSelectedModelId} 
              />

              <div className="flex flex-col space-y-2">
                <label className="text-sm font-medium text-slate-400">Number of Images</label>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700">
                    {[1, 4, 8].map((num) => (
                      <button
                        key={num}
                        onClick={() => setImageCount(num)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          imageCount === num 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {num}
                      </button>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2 bg-slate-800 p-1 px-2 rounded-lg border border-slate-700">
                    <span className="text-xs text-slate-500 font-medium">Custom:</span>
                    <input 
                      type="number" 
                      min="1" 
                      max="20"
                      value={imageCount}
                      onChange={(e) => setImageCount(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))}
                      className="w-12 bg-transparent text-sm text-white focus:outline-none text-center"
                    />
                  </div>
                </div>
              </div>

              {selectedModelId.includes('nano-banana') && (
                 <div className="flex flex-col space-y-4">
                   <div className="flex flex-col space-y-2">
                     <label className="text-sm font-medium text-slate-400">Aspect Ratio</label>
                     <div className="flex flex-wrap gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 w-fit">
                       {['auto', '1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'].map((ratio) => (
                         <button
                           key={ratio}
                           onClick={() => setNanoAspectRatio(ratio)}
                           className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                             nanoAspectRatio === ratio 
                               ? 'bg-indigo-600 text-white shadow-sm' 
                               : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                           }`}
                         >
                           {ratio}
                         </button>
                       ))}
                     </div>
                   </div>

                   <div className="flex flex-col space-y-2">
                     <label className="text-sm font-medium text-slate-400">Resolution (Higher = Slower)</label>
                     <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 w-fit">
                       {(selectedModelId === 'nano-banana-pro-4k-vip' ? ['4K'] : 
                         selectedModelId === 'nano-banana-pro-vip' ? ['1K', '2K'] : 
                         ['1K', '2K', '4K']).map((res) => (
                         <button
                           key={res}
                           onClick={() => setNanoResolution(res)}
                           className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                             nanoResolution === res 
                               ? 'bg-indigo-600 text-white shadow-sm' 
                               : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                           }`}
                         >
                           {res}
                         </button>
                       ))}
                     </div>
                   </div>
                 </div>
               )}

               {VIDEO_MODELS.some(m => m.id === selectedModelId) && (
                 <div className="flex flex-col space-y-2">
                   <label className="text-sm font-medium text-slate-400">Video Aspect Ratio</label>
                   <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 w-fit">
                     {['16:9', '9:16'].map((ratio) => (
                       <button
                         key={ratio}
                         onClick={() => setVideoAspectRatio(ratio)}
                         className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                           videoAspectRatio === ratio 
                             ? 'bg-indigo-600 text-white shadow-sm' 
                             : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                         }`}
                       >
                         {ratio}
                       </button>
                     ))}
                   </div>
                 </div>
               )}

               {(selectedModelId === 'gpt-image-1.5' || selectedModelId === 'sora-image') && (
                <div className="flex flex-col space-y-2">
                  <label className="text-sm font-medium text-slate-400">Image Size (Aspect Ratio)</label>
                  <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 w-fit">
                    {['auto', '1:1', '3:2', '2:3'].map((size) => (
                      <button
                        key={size}
                        onClick={() => setImageSize(size)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                          imageSize === size 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="A cinematic drone shot of a futuristic city with flying cars in a cyberpunk aesthetic..."
                  className="w-full h-32 bg-slate-800/50 border border-slate-700 rounded-xl p-4 text-white placeholder-slate-500 focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none transition-all text-lg"
                />
                
                <div className="flex flex-col gap-4 w-full">
                  <div className="flex flex-col sm:flex-row gap-4 w-full">
                    <button
                      onClick={handleGenerateImages}
                      disabled={!prompt.trim()}
                      className="flex-1 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-lg transition-all shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
                    >
                      <span>Generate Storyboard</span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M6 2c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2H6zm9 7h-1.5v2.5h-2.5v1.5h2.5V15H15v-1.5h2.5v-1.5H15V9zm-4.5 9H9v-1.5h1.5V18zm0-2.5H9v-1.5h1.5v1.5zm0-2.5H9v-1.5h1.5V13zm-2.5 5H6v-1.5h1.5V18zm0-2.5H6v-1.5h1.5v1.5zm0-2.5H6v-1.5h1.5V13z" />
                      </svg>
                    </button>
                    <button
                      onClick={handleDirectVideoGeneration}
                      disabled={!prompt.trim()}
                      className="flex-1 py-4 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl font-semibold text-lg transition-all shadow-lg shadow-slate-900/20 flex items-center justify-center gap-2 border border-slate-600"
                    >
                      <span>Quick Video with {currentModel?.name}</span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.94-.94 2.56-.27 2.56 1.06v11.38c0 1.33-1.62 2-2.56 1.06z" />
                      </svg>
                    </button>
                  </div>

                  <div className="relative">
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold text-lg transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2"
                    >
                      <span>Upload Images to Animate</span>
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                        <path fillRule="evenodd" d="M11.47 2.47a.75.75 0 011.06 0l4.5 4.5a.75.75 0 01-1.06 1.06l-3.22-3.22V16.5a.75.75 0 01-1.5 0V4.81L8.03 8.03a.75.75 0 01-1.06-1.06l4.5-4.5zM3 15.75a.75.75 0 01.75.75v2.25a1.5 1.5 0 001.5 1.5h13.5a1.5 1.5 0 001.5-1.5V16.5a.75.75 0 011.5 0v2.25a3 3 0 01-3 3H5.25a3 3 0 01-3-3V16.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* STEP 2: LOADING IMAGES */}
        {step === AppStep.GENERATING_IMAGES && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="text-center space-y-4 max-w-2xl mx-auto">
              <h3 className="text-2xl font-bold text-white">Dreaming up your storyboard...</h3>
              <LoadingBar progress={imageProgress} message={`Generating ${images.length} of ${imageCount} frames...`} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {images.map((img) => (
                <div 
                  key={img.id}
                  className="flex flex-col bg-slate-800 rounded-xl overflow-hidden border-2 border-slate-700"
                >
                  <div className="relative aspect-video">
                    {img.base64 ? (
                      <img 
                        src={`data:${img.mimeType};base64,${img.base64}`} 
                        alt="Storyboard frame" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center space-y-3">
                        <div className="relative w-16 h-16">
                          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20"></div>
                          <div 
                            className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"
                            style={{ animationDuration: '1s' }}
                          ></div>
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                            {img.progress || 0}%
                          </div>
                        </div>
                        <span className="text-xs font-medium text-slate-400">
                          {img.status === 'pending' ? 'Waiting...' : 'Imagining...'}
                        </span>
                      </div>
                    )}
                    {img.status === 'processing' && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${img.progress || 0}%` }}
                        ></div>
                      </div>
                    )}
                    {img.status === 'failed' && (
                      <div className="absolute inset-0 bg-red-900/20 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                        <span className="text-red-400 text-xs font-bold uppercase tracking-wider mb-2">Failed</span>
                        <p className="text-[10px] text-red-300 line-clamp-3">{img.error}</p>
                      </div>
                    )}
                  </div>
                  <div className="p-4 bg-slate-800/50">
                    <div className="h-2 w-24 bg-slate-700 rounded animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 3: SELECTION */}
        {step === AppStep.SELECTION && (
          <div className="space-y-8 animate-in fade-in duration-500">
            {/* Sticky Header with Selection Info and Model Selection */}
            <div className="flex flex-col gap-6 sticky top-20 z-40 bg-slate-900/95 p-6 rounded-xl border border-slate-800 backdrop-blur-md shadow-2xl transition-all">
              <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">1. Choose Video Model</label>
                  <ModelSelector 
                    models={VIDEO_MODELS} 
                    selectedModelId={selectedVideoModelId} 
                    onSelect={setSelectedVideoModelId} 
                  />
                </div>

                <div className="flex-none">
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">2. Aspect Ratio</label>
                  <div className="flex gap-1 bg-slate-800 p-1 rounded-lg border border-slate-700 w-fit">
                    {['16:9', '9:16'].map((ratio) => (
                      <button
                        key={ratio}
                        onClick={() => setVideoAspectRatio(ratio)}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
                          videoAspectRatio === ratio 
                            ? 'bg-indigo-600 text-white shadow-sm' 
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                        }`}
                      >
                        {ratio}
                      </button>
                    ))}
                  </div>
                </div>
                
                <div className="flex items-center gap-4 bg-slate-800 p-4 rounded-xl border border-slate-700">
                  <div className="text-right">
                    <span className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">3. Ready to Animate</span>
                    <span className="text-sm font-medium text-slate-300">
                      {selectedCount} images selected
                    </span>
                  </div>
                  <button
                    onClick={handleGenerateVideosFromImages}
                    disabled={selectedCount === 0}
                    className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-bold transition-all shadow-lg shadow-indigo-500/20 flex items-center gap-2"
                  >
                    <span>Generate Videos</span>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                      <path d="M4.5 4.5a3 3 0 00-3 3v9a3 3 0 003 3h8.25a3 3 0 003-3v-9a3 3 0 00-3-3H4.5zM19.94 18.75l-2.69-2.69V7.94l2.69-2.69c.94-.94 2.56-.27 2.56 1.06v11.38c0 1.33-1.62 2-2.56 1.06z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Image Grid with Prompt Editing */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {/* Add More Images Card */}
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center bg-slate-800/30 rounded-xl border-2 border-dashed border-slate-700 hover:border-indigo-500 hover:bg-slate-800/50 transition-all cursor-pointer group min-h-[300px]"
              >
                <div className="w-12 h-12 rounded-full bg-slate-700 group-hover:bg-indigo-600 flex items-center justify-center mb-4 transition-colors">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white">
                    <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                  </svg>
                </div>
                <span className="text-sm font-medium text-slate-400 group-hover:text-slate-200">Add More Images</span>
              </div>

              {images.map((img) => (
                <div 
                  key={img.id}
                  className={`flex flex-col bg-slate-800 rounded-xl overflow-hidden border-2 transition-all duration-200 ${img.selected ? 'border-indigo-500 shadow-xl shadow-indigo-500/10' : 'border-slate-700'}`}
                >
                  <div 
                    onClick={() => toggleImageSelection(img.id)}
                    className="relative aspect-video cursor-pointer group"
                  >
                    {img.base64 ? (
                      <img 
                        src={`data:${img.mimeType};base64,${img.base64}`} 
                        alt="Storyboard frame" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-slate-900 flex flex-col items-center justify-center p-6 text-center space-y-3">
                        <div className="relative w-16 h-16">
                          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20"></div>
                          <div 
                            className="absolute inset-0 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"
                            style={{ animationDuration: '1s' }}
                          ></div>
                          <div className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-indigo-400">
                            {img.progress || 0}%
                          </div>
                        </div>
                        <span className="text-xs font-medium text-slate-400">Imagining...</span>
                      </div>
                    )}
                    <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200 ${img.selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${img.selected ? 'bg-indigo-500 text-white shadow-lg' : 'bg-white/20 text-white backdrop-blur-sm'}`}>
                        {img.selected ? (
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                            <path fillRule="evenodd" d="M19.916 4.626a.75.75 0 01.208 1.04l-9 13.5a.75.75 0 01-1.154.114l-6-6a.75.75 0 011.06-1.06l5.353 5.353 8.493-12.739a.75.75 0 011.04-.208z" clipRule="evenodd" />
                          </svg>
                        ) : (
                          <span className="text-xs font-bold">SELECT</span>
                        )}
                      </div>
                    </div>
                    {/* Individual Progress Bar at bottom of image */}
                    {img.status === 'processing' && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-900">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-500"
                          style={{ width: `${img.progress || 0}%` }}
                        ></div>
                      </div>
                    )}
                  </div>
                  
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Video Prompt</span>
                      <div className="flex items-center gap-2">
                        {img.selected && <span className="text-[10px] font-bold text-indigo-400 uppercase tracking-widest animate-pulse">Selected</span>}
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteImage(img.id);
                          }}
                          className="text-slate-500 hover:text-red-400 transition-colors"
                          title="Delete image"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 013.878.512.75.75 0 11-.256 1.478l-.209-.035-1.005 13.07a3 3 0 01-2.991 2.77H8.084a3 3 0 01-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 01-.256-1.478A48.567 48.567 0 017.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 013.369 0c1.603.051 2.815 1.387 2.815 2.951zm-6.136-1.452a51.196 51.196 0 013.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 00-6 0v-.113c0-.794.609-1.428 1.364-1.452zm-.355 5.945a.75.75 0 10-1.5 0l.5 8.5a.75.75 0 101.5 0l-.5-8.5zm4.33.25a.75.75 0 00-1.5 0l.5 8.5a.75.75 0 001.5 0l-.5-8.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={img.prompt || ''}
                      onChange={(e) => updateImagePrompt(img.id, e.target.value)}
                      placeholder="Describe motion for this frame..."
                      className="w-full h-24 bg-slate-900 border border-slate-700 rounded-lg p-3 text-white placeholder-slate-600 focus:ring-1 focus:ring-indigo-500 focus:border-transparent resize-none transition-all text-xs leading-relaxed"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* STEP 4: GENERATING & SHOWING VIDEOS */}
        {step === AppStep.GENERATING_VIDEOS && (
          <div className="space-y-12 animate-in fade-in duration-500">
             
             {/* Progress Header */}
             <div className="text-center space-y-4 max-w-2xl mx-auto">
               <h3 className="text-2xl font-bold text-white">Producing your videos</h3>
               {generatingVideosCount.current < generatingVideosCount.total ? (
                 <LoadingBar 
                    progress={(generatingVideosCount.current / generatingVideosCount.total) * 100} 
                    message={`Rendering video ${generatingVideosCount.current + 1} of ${generatingVideosCount.total} using ${currentVideoModel?.name}...`}
                 />
               ) : (
                 <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl text-green-400 font-medium">
                    All videos completed!
                 </div>
               )}

               {videos.some(v => v.status === 'completed') && (
                 <button
                   onClick={handleBatchDownload}
                   disabled={isDownloading}
                   className={`mt-4 inline-flex items-center gap-2 px-6 py-2 rounded-full font-bold transition-all ${
                     isDownloading 
                       ? 'bg-slate-700 text-slate-400 cursor-not-allowed' 
                       : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/25'
                   }`}
                 >
                   {isDownloading ? (
                     <>
                       <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent animate-spin rounded-full"></div>
                       Zipping...
                     </>
                   ) : (
                     <>
                       <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                       </svg>
                       Batch Download ({videos.filter(v => v.status === 'completed').length})
                     </>
                   )}
                 </button>
               )}
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {videos.map((vid) => {
                  const sourceImg = vid.imageId ? images.find(i => i.id === vid.imageId) : undefined;
                  const vidModel = AVAILABLE_MODELS.find(m => m.id === vid.modelUsed);
                  
                  return (
                    <div key={vid.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-xl flex flex-col">
                      <div className="aspect-video relative bg-black">
                        {vid.status === 'completed' && vid.url ? (
                           <video 
                              src={vid.url} 
                              controls 
                              className="w-full h-full object-cover"
                              poster={sourceImg ? `data:${sourceImg.mimeType};base64,${sourceImg.base64}` : undefined}
                           />
                        ) : (
                          <>
                            {sourceImg ? (
                              <img 
                                src={`data:${sourceImg.mimeType};base64,${sourceImg.base64}`} 
                                className="w-full h-full object-cover opacity-50 blur-sm"
                                alt="Processing placeholder"
                              />
                            ) : (
                              /* Placeholder for text-to-video processing */
                              <div className="w-full h-full bg-slate-900 flex items-center justify-center opacity-50">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                </svg>
                              </div>
                            )}
                            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center">
                              {vid.status === 'pending' && (
                                <span className="text-slate-400 text-sm font-medium bg-slate-900/80 px-3 py-1 rounded-full">Pending...</span>
                              )}
                              {vid.status === 'processing' && (
                                <div className="flex flex-col items-center gap-4 w-full max-w-[200px]">
                                  <div className="relative w-16 h-16">
                                    <div className="absolute inset-0 rounded-full border-4 border-indigo-500/20"></div>
                                    <svg className="absolute inset-0 w-full h-full -rotate-90">
                                      <circle
                                        cx="32"
                                        cy="32"
                                        r="28"
                                        fill="transparent"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                        className="text-indigo-500 transition-all duration-500"
                                        strokeDasharray={175.9}
                                        strokeDashoffset={175.9 - (175.9 * (vid.progress || 0)) / 100}
                                      />
                                    </svg>
                                    <div className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white">
                                      {vid.progress || 0}%
                                    </div>
                                  </div>
                                  <div className="space-y-1 w-full">
                                    <span className="text-indigo-400 text-sm font-medium bg-slate-900/80 px-3 py-1 rounded-full block mx-auto w-fit">
                                      {vid.progress && vid.progress < 30 ? 'Uploading...' : 'Rendering...'}
                                    </span>
                                  </div>
                                </div>
                              )}
                              {vid.status === 'failed' && (
                                <div className="flex flex-col items-center gap-2">
                                  <span className="text-red-400 text-sm font-medium bg-red-900/20 px-3 py-1 rounded-full border border-red-500/20">Generation Failed</span>
                                  {vid.error && (
                                    <p className="text-[10px] text-red-400/80 max-w-[200px] line-clamp-3 bg-black/50 p-2 rounded-lg backdrop-blur-sm border border-red-500/10">
                                      {vid.error}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                      <div className="p-4 flex flex-col gap-2">
                         <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  vid.status === 'completed' ? 'bg-green-500' : 
                                  vid.status === 'processing' ? 'bg-indigo-500 animate-pulse' : 
                                  vid.status === 'failed' ? 'bg-red-500' : 'bg-slate-500'
                                }`}></div>
                                <span className="text-sm font-medium text-slate-300 capitalize">{vid.status}</span>
                            </div>
                            {vid.status === 'completed' && vid.url && (
                              <a 
                                href={vid.url} 
                                download="generated_video.mp4"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                              >
                                Download
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                  <path d="M10.75 2.75a.75.75 0 00-1.5 0v8.614L6.295 8.235a.75.75 0 10-1.09 1.03l4.25 4.5a.75.75 0 001.09 0l4.25-4.5a.75.75 0 00-1.09-1.03l-2.955 3.129V2.75z" />
                                  <path d="M3.5 12.75a.75.75 0 00-1.5 0v2.5A2.75 2.75 0 004.75 18h10.5A2.75 2.75 0 0018 15.25v-2.5a.75.75 0 00-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5z" />
                                </svg>
                              </a>
                            )}
                         </div>
                         
                         {/* Model Badge on Card */}
                         <div className="flex items-center gap-2 mt-1">
                           <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">
                              {vidModel?.name || vid.modelUsed}
                           </span>
                         </div>

                         {/* Show Prompt Used */}
                         {vid.prompt && (
                            <p className="text-xs text-slate-500 line-clamp-2 mt-1" title={vid.prompt}>
                              {vid.prompt}
                            </p>
                         )}

                         {/* Individual Video Progress Bar at bottom of info section */}
                         {vid.status === 'processing' && (
                           <div className="mt-3 h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                             <div 
                               className="h-full bg-indigo-500 transition-all duration-500"
                               style={{ width: `${vid.progress || 0}%` }}
                             ></div>
                           </div>
                         )}
                      </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}

      </main>
    </div>
  );
}
