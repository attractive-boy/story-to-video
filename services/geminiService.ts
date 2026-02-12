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
 * Check for API key in localStorage.
 * If missing, prompt the user to enter it.
 */
export const checkAndRequestApiKey = async (): Promise<boolean> => {
  let apiKey = localStorage.getItem("grsai_api_key");
  
  if (!apiKey) {
    apiKey = prompt("Please enter your Grsai API Key (from https://grsai.ai/zh/dashboard/models):");
    if (apiKey && apiKey.trim()) {
      localStorage.setItem("grsai_api_key", apiKey.trim());
      return true;
    }
    return false;
  }
  
  return true;
};

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Common polling logic for task results
 */
const pollTaskResult = async (taskId: string, modelType: string): Promise<string> => {
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
    
    console.log(`${modelType} Task ${taskId} status: ${status} (${resultData.data?.progress || 0}%)`);

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
const generateNanoBananaImage = async (prompt: string, modelId: string): Promise<string> => {
  const initResponse = await fetch(`${API_BASE_URL}/draw/nano-banana`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      prompt: prompt,
      model: modelId,
      aspectRatio: "1:1",
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

  return pollTaskResult(taskId, "Nano Banana");
};

/**
 * Handles the GPT Image / Sora Image specific asynchronous flow.
 */
const generateGptImage = async (prompt: string, modelId: string): Promise<string> => {
  const initResponse = await fetch(`${API_BASE_URL}/draw/completions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      prompt: prompt,
      model: modelId,
      size: "1:1",
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

  return pollTaskResult(taskId, "GPT Image");
};

/**
 * Generates images using Grsai API.
 * Supports standard OpenAI-compatible endpoints, Nano Banana and GPT Image specific flows.
 */
export const generateBatchImages = async (
  prompt: string, 
  count: number = 20,
  onProgress: (count: number) => void,
  modelId: string = "nano-banana-pro"
): Promise<ImageAsset[]> => {
  const results: ImageAsset[] = [];
  const TOTAL_IMAGES = count;
  
  try {
    const promises = [];
    for (let i = 0; i < TOTAL_IMAGES; i++) {
      // Choose the generation function based on modelId
      const generationFn = (modelId === "gpt-image-1.5" || modelId === "sora-image")
        ? () => generateGptImage(prompt, modelId)
        : () => generateNanoBananaImage(prompt, modelId);

      promises.push(
        generationFn()
          .then(urlOrB64 => {
             // Check if it's a URL or Base64
             // If URL, we might need to fetch it to convert to base64 for our app (since we use base64 internally)
             // Or just store the URL if our app supports it.
             // Looking at types.ts, ImageAsset expects 'base64'.
             
             if (urlOrB64.startsWith("http")) {
               return fetch(urlOrB64)
                 .then(res => res.blob())
                 .then(blob => new Promise<string>((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64data = reader.result as string;
                        // remove data:image/png;base64, prefix if present, as our type expects 'base64' content? 
                        // Actually let's check how it's used.
                        // In createPlaceholderImage it returned btoa(svg), which is just the base64 string.
                        // In generateVideoFromImage, it uses `data:${image.mimeType};base64,${image.base64}`.
                        // So image.base64 should be the RAW base64 string.
                        
                        const parts = base64data.split(',');
                        resolve(parts.length > 1 ? parts[1] : base64data);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(blob);
                 }));
             } else {
               return urlOrB64;
             }
          })
          .then(base64 => {
             const asset: ImageAsset = {
               id: crypto.randomUUID(),
               base64: base64,
               mimeType: 'image/png', // Assume png
               selected: false
             };
             // Push directly to results not needed here if we collect them at the end, 
             // but we need to track progress.
             // We can't safely push to results array in parallel without locking or being careful,
             // but JS is single threaded so pushing is fine.
             results.push(asset);
             onProgress(results.length);
             return asset;
          })
      );
    }
    
    // Use allSettled to allow partial success
    const outcomes = await Promise.allSettled(promises);
    
    // Check if any succeeded
    const succeeded = outcomes.filter(o => o.status === 'fulfilled');
    
    if (succeeded.length === 0) {
        // If all failed, find the first rejection reason
        const firstError = outcomes.find(o => o.status === 'rejected') as PromiseRejectedResult;
        throw firstError.reason || new Error("All image generations failed.");
    }
    
    // We already populated `results` inside the .then(), but order might be mixed.
    // That's fine for now.
    
  } catch (error) {
    console.error("Image generation error:", error);
    // If Nano Banana fails, maybe fallback to standard generation?
    // For now, throw.
    throw error;
  }

  return results;
};

/**
 * Handles the Sora 2.0 Video generation flow.
 * 1. POST /v1/video/sora
 * 2. POST /v1/draw/result (poll until success)
 */
export const generateVideoFromImage = async (
  prompt: string,
  base64Image: string,
  modelId: string = "sora-2.0"
): Promise<string> => {
  // Determine endpoint based on model type
  const isVeo = modelId.toLowerCase().includes("veo");
  const endpoint = isVeo ? "/video/veo" : "/video/sora";
  
  const initResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      prompt: prompt,
      model: modelId,
      image: base64Image,
      duration: "5",
      aspectRatio: "1:1",
      webHook: "-1"
    })
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

  return pollTaskResult(taskId, isVeo ? 'VEO' : 'Sora');
};


/**
 * Generate video directly from text.
 */
export const generateVideoFromText = async (
  prompt: string,
  modelId: string
): Promise<string> => {
  console.log(`Generating video using model: ${modelId}`);

  const isSpecialVideo = modelId.toLowerCase().includes("veo") || modelId.toLowerCase().includes("sora-2");

  if (isSpecialVideo) {
    const isVeo = modelId.toLowerCase().includes("veo");
    const endpoint = isVeo ? "/video/veo" : "/video/sora";
    
    const initResponse = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        prompt: prompt,
        model: modelId,
        duration: "5",
        aspectRatio: "1:1",
        webHook: "-1"
      })
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

    return pollTaskResult(taskId, isVeo ? 'VEO' : 'Sora');
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
