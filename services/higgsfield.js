const HF_API_URL = "https://api.higgsfield.ai";

const MODELS = {
  bytedance: {
    endpoints: ["bytedance_video_upscale", "bytedance/video-upscale"],
    resolutions: { "1080p": "1080p", "2k": "2k", "4k": "4k", "8k": "8k" },
    body(videoUrl, resolution, options) {
      return {
        video_url: videoUrl,
        resolution,
        creativity_mode: options.creativityMode,
        frame_interpolation: options.frameInterpolation,
      };
    },
  },
  flux3: {
    endpoints: ["black-forest-labs/flux-video-upscale", "flux/upscale/video"],
    resolutions: { "1080p": "1080p", "2k": "2k", "4k": "4k" },
    body(videoUrl, resolution, options) {
      return {
        video_url: videoUrl,
        input_video: videoUrl,
        resolution,
        upscale_factor: resolution === "4k" ? 3 : resolution === "2k" ? 2 : 1.5,
        creativity: options.creativityMode === "bold" ? 1 : 0,
        creativity_mode: options.creativityMode,
        frame_interpolation: options.frameInterpolation,
      };
    },
  },
  topaz: {
    endpoints: ["topaz_video", "topaz/upscale/video"],
    resolutions: { "1080p": "1080p", "2k": "2k", "4k": "4k", "2160p": "2160p" },
    body(videoUrl, resolution, options) {
      return {
        input_video: { url: videoUrl },
        video_url: videoUrl,
        resolution,
        creativity_mode: options.creativityMode,
        frame_interpolation: options.frameInterpolation,
      };
    },
  },
};

function authHeader() {
  if (!process.env.HF_API_KEY) {
    throw new Error("HF_API_KEY is missing in .env");
  }
  return { Authorization: `Key ${process.env.HF_API_KEY}` };
}

function outputUrlFrom(payload) {
  return (
    payload?.video?.url ||
    payload?.videos?.[0]?.url ||
    payload?.output?.url ||
    payload?.output_url ||
    payload?.url ||
    null
  );
}

async function higgsfield(path, options = {}) {
  const response = await fetch(`${HF_API_URL}${path}`, {
    ...options,
    headers: {
      ...authHeader(),
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = data.detail || data.message || data.error || "Higgsfield request failed";
    const error = new Error(typeof message === "string" ? message : JSON.stringify(message));
    error.statusCode = response.status;
    error.payload = data;
    throw error;
  }
  return data;
}

function isMissingModel(error) {
  const text = `${error.message} ${JSON.stringify(error.payload || {})}`.toLowerCase();
  return text.includes("model_not_found") || text.includes("model not found");
}

async function submitModel(model, videoUrl, resolution, options) {
  let lastError;
  for (const endpoint of model.endpoints) {
    try {
      const submitted = await higgsfield(`/${endpoint}`, {
        method: "POST",
        body: JSON.stringify(model.body(videoUrl, resolution, options)),
      });
      return { ...submitted, endpoint };
    } catch (error) {
      lastError = error;
      if (!isMissingModel(error)) throw error;
    }
  }
  if (isMissingModel(lastError) && model.endpoints.some((endpoint) => endpoint.includes("flux"))) {
    throw new Error(
      "flux3 is not available on this Higgsfield API key. bytedance and topaz are the upscale models this account can call."
    );
  }
  throw lastError;
}

async function waitForVideo(requestId) {
  const deadline = Date.now() + 15 * 60 * 1000;
  while (Date.now() < deadline) {
    const data = await higgsfield(`/requests/${requestId}/status`);
    if (data.status === "completed") {
      const url = outputUrlFrom(data);
      if (!url) throw new Error("Upscale finished without a video URL");
      return url;
    }
    if (["failed", "nsfw", "canceled"].includes(data.status)) {
      throw new Error(data.error?.message || data.detail || `Upscale ${data.status}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 4000));
  }
  throw new Error("Upscale timed out");
}

module.exports = {
  MODELS,
  submitModel,
  waitForVideo,
};
