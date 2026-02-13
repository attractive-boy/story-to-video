import { ImageAsset } from "../types";

const API_BASE_URL = "https://grsai.dakka.com.cn/v1";

// Helper to get headers
const getHeaders = () => {
  const apiKey = localStorage.getItem("grsai_api_key");
  // const apiKey = "sk-b1fbacf45eb54759a9912da1306f63ad"
  return {
    "Content-Type": "application/json",
    "Authorization": `Bearer ${apiKey}`
  };
};

/**
 * Reset API key in localStorage.
 */
export const resetApiKey = () => {
  localStorage.removeItem("grsai_api_key");
};

/**
 * Check for API key in localStorage.
 */
export const checkApiKey = (): boolean => {
  const apiKey = localStorage.getItem("grsai_api_key");
  return !!(apiKey && apiKey.trim());
};

/**
 * Set API key in localStorage.
 */
export const setApiKey = (key: string) => {
  if (key && key.trim()) {
    localStorage.setItem("grsai_api_key", key.trim());
  }
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Common polling logic for task results
 */
const pollTaskResult = async (
  taskId: string, 
  modelType: string,
  onProgress?: (progress: number) => void
): Promise<string> => {
  let attempts = 0;
  const MAX_ATTEMPTS = 120; // 10 minutes
  
  while (attempts < MAX_ATTEMPTS) {
    await wait(5000);
    const resultResponse = await fetch(`${API_BASE_URL}/draw/result`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({ id: taskId })
    });

    if (!resultResponse.ok) {
      console.error(`${modelType} polling error:`, resultResponse.statusText);
      attempts++;
      continue;
    }

    const resultData = await resultResponse.json();
    const status = resultData.data?.status;
    const progress = resultData.data?.progress || 0;
    
    if (onProgress) {
      onProgress(progress);
    }

    console.log(`${modelType} Task ${taskId} status: ${status} (${progress}%)`);

    if (status === "succeeded" && (resultData.data?.results?.[0]?.url || resultData.data?.url)) {
      let url = resultData.data?.results?.[0].url?.trim() || resultData.data?.url?.trim();
      url = url.replace(/[`\s]/g, "");
      return url;
    } else if (status === "failed") {
      throw new Error(resultData.data?.error || resultData.data?.failure_reason || `${modelType} generation failed`);
    }

    attempts++;
  }

  throw new Error(`${modelType} generation timed out`);
};

/**
 * Handles the Nano Banana specific asynchronous flow.
 */
const generateNanoBananaImage = async (
  prompt: string, 
  modelId: string,
  onProgress?: (progress: number) => void,
  aspectRatio: string = "auto",
  imageSize: string = "1K"
): Promise<string> => {
  const initResponse = await fetch(`${API_BASE_URL}/draw/nano-banana`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      prompt: prompt,
      model: modelId,
      aspectRatio: aspectRatio,
      imageSize: imageSize,
      webHook: "-1"
    })
  });

  if (!initResponse.ok) {
    const errorData = await initResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Nano Banana init failed: ${initResponse.statusText}`);
  }

  const initData = await initResponse.json();
  const taskId = initData.data?.id;

  if (!taskId) {
    throw new Error("No task ID received from Nano Banana API");
  }

  return pollTaskResult(taskId, "Nano Banana", onProgress);
};

/**
 * Handles the GPT Image / Sora Image specific asynchronous flow.
 */
const generateGptImage = async (
  prompt: string, 
  modelId: string,
  onProgress?: (progress: number) => void,
  size: string = "1:1"
): Promise<string> => {
  const initResponse = await fetch(`${API_BASE_URL}/draw/completions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      prompt: prompt,
      model: modelId,
      size: size,
      webHook: "-1"
    })
  });

  if (!initResponse.ok) {
    const errorData = await initResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `GPT Image init failed: ${initResponse.statusText}`);
  }

  const initData = await initResponse.json();
  const taskId = initData.data?.id;

  if (!taskId) {
    throw new Error("No task ID received from GPT Image API");
  }

  return pollTaskResult(taskId, "GPT Image", onProgress);
};

/**
 * Generates images using Grsai API.
 * Supports standard OpenAI-compatible endpoints, Nano Banana and GPT Image specific flows.
 */
export const generateBatchImages = async (
  prompt: string, 
  count: number = 20,
  onItemUpdate: (asset: Partial<ImageAsset>) => void,
  modelId: string = "nano-banana-pro",
  aspectRatioOrSize: string = "1:1",
  imageSize: string = "1K"
): Promise<ImageAsset[]> => {
  const results: ImageAsset[] = [];
  const TOTAL_IMAGES = count;
  
  try {
    const promises = [];
    for (let i = 0; i < TOTAL_IMAGES; i++) {
      const assetId = crypto.randomUUID();
      
      // Initialize the asset
      onItemUpdate({
        id: assetId,
        status: 'pending',
        progress: 0
      });

      // Choose the generation function based on modelId
      const generationFn = (modelId === "gpt-image-1.5" || modelId === "sora-image")
        ? (p: string, m: string, cb: (prog: number) => void) => generateGptImage(p, m, cb, aspectRatioOrSize)
        : (p: string, m: string, cb: (prog: number) => void) => generateNanoBananaImage(p, m, cb, aspectRatioOrSize, imageSize);

      promises.push(
        generationFn(prompt, modelId, (prog) => {
          onItemUpdate({ id: assetId, progress: prog, status: 'processing' });
        })
          .then(urlOrB64 => {
             if (urlOrB64.startsWith("http")) {
               const url = urlOrB64;
               return fetch(url)
                 .then(res => res.blob())
                 .then(blob => new Promise<{base64: string, url: string}>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result as string;
                        const parts = base64data.split(',');
                        resolve({
                          base64: parts.length > 1 ? parts[1] : base64data,
                          url: url
                        });
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                 }));
             } else {
               return { base64: urlOrB64, url: '' };
             }
          })
          .then(({base64, url}) => {
             const asset: ImageAsset = {
               id: assetId,
               base64: base64,
               url: url || undefined,
               mimeType: 'image/png', // Assume png
               selected: false,
               status: 'completed',
               progress: 100
             };
             onItemUpdate(asset);
             results.push(asset);
             return asset;
          })
          .catch(err => {
            onItemUpdate({ 
              id: assetId, 
              status: 'failed', 
              error: err instanceof Error ? err.message : String(err) 
            });
            throw err;
          })
      );
    }
    
    // Use allSettled to allow partial success
    const outcomes = await Promise.allSettled(promises);
    
    // Check if any succeeded
    const succeeded = outcomes.filter(o => o.status === 'fulfilled');
    
    if (succeeded.length === 0 && TOTAL_IMAGES > 0) {
        // If all failed, find the first rejection reason
        const firstError = outcomes.find(o => o.status === 'rejected') as PromiseRejectedResult;
        throw firstError.reason || new Error("All image generations failed.");
    }
    
  } catch (error) {
    console.error("Image generation error:", error);
    throw error;
  }

  return results;
};

/**
 * Uploads a base64 image to Azure Storage via the local API route.
 */
export const uploadImageToAzure = async (base64: string, mimeType: string): Promise<string> => {
  const response = await fetch('/api/upload', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base64,
      mimeType,
      fileName: `image-${Date.now()}.png`
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error || 'Failed to upload image to Azure');
  }

  const data = await response.json();
  return data.url;
};

/**
 * Handles the Sora 2.0 Video generation flow.
 * 1. POST /v1/video/sora
 * 2. POST /v1/draw/result (poll until success)
 */
export const generateVideoFromImage = async (
  prompt: string,
  imageSource: string, // Can be base64 or URL
  modelId: string = "sora-2.0",
  onProgress?: (progress: number) => void,
  aspectRatio: string = "16:9"
): Promise<string> => {
  // Determine endpoint based on model type
  const isVeo = modelId.toLowerCase().includes("veo");
  const endpoint = isVeo ? "/video/veo" : "/video/sora";
  
  const requestBody: any = {
    prompt: prompt,
    model: modelId,
    duration: "5",
    aspectRatio: aspectRatio,
    webHook: "-1"
  };

  if (isVeo) {
    // Veo specific structure: image URL should be in 'urls' array
    requestBody.firstFrameUrl = "";
    requestBody.lastFrameUrl = "";
    requestBody.urls = [imageSource];
    requestBody.shutProgress = false;
  } else {
    // Sora or other models
    requestBody.image = imageSource;
  }
  
  const initResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(requestBody)
  });

  if (!initResponse.ok) {
    const errorData = await initResponse.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Video generation failed: ${initResponse.statusText}`);
  }

  const initData = await initResponse.json();
  const taskId = initData.data?.id;

  if (!taskId) {
    throw new Error(`No task ID received from ${isVeo ? 'VEO' : 'Sora'} Video API`);
  }

  return pollTaskResult(taskId, isVeo ? 'VEO' : 'Sora', onProgress);
};


/**
 * Generate video directly from text.
 */
export const generateVideoFromText = async (
  prompt: string,
  modelId: string,
  onProgress?: (progress: number) => void,
  aspectRatio: string = "16:9"
): Promise<string> => {
  console.log(`Generating video using model: ${modelId}`);

  const isSpecialVideo = modelId.toLowerCase().includes("veo") || modelId.toLowerCase().includes("sora-2");

  if (isSpecialVideo) {
    const isVeo = modelId.toLowerCase().includes("veo");
    const endpoint = isVeo ? "/video/veo" : "/video/sora";
    
    const requestBody: any = {
      prompt: prompt,
      model: modelId,
      duration: "5",
      aspectRatio: aspectRatio,
      webHook: "-1"
    };

    if (isVeo) {
      requestBody.firstFrameUrl = "";
      requestBody.lastFrameUrl = "";
      requestBody.urls = [];
      requestBody.shutProgress = false;
    }
    
    const initResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(requestBody)
    });

    if (!initResponse.ok) {
      const errorData = await initResponse.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Video generation failed: ${initResponse.statusText}`);
    }

    const initData = await initResponse.json();
    const taskId = initData.data?.id;

    if (!taskId) {
      throw new Error(`No task ID received from ${isVeo ? 'VEO' : 'Sora'} Video API`);
    }

    return pollTaskResult(taskId, isVeo ? 'VEO' : 'Sora', onProgress);
  }

  // Fallback for standard models
  const response = await fetch(`${API_BASE_URL}/video/generations`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      model: modelId,
      prompt: prompt,
      response_format: "url"
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    // Fallback logic
    if (response.status === 404) {
      return generateVideoFromTextFallback(prompt, modelId);
    }
    throw new Error(errorData.error?.message || "Video generation failed");
  }

  const data = await response.json();
  if (data.data && data.data.length > 0) {
    return data.data[0].url;
  }
  
  throw new Error("No video URL returned");
};

const generateVideoFromTextFallback = async (prompt: string, modelId: string): Promise<string> => {
  const response = await fetch(`${API_BASE_URL}/images/generations`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      model: modelId,
      prompt: prompt,
      n: 1
    })
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error?.message || "Video generation failed (fallback)");
  }
  
  const data = await response.json();
  if (data.data && data.data.length > 0) {
    return data.data[0].url;
  }
  throw new Error("No video URL returned");
};
