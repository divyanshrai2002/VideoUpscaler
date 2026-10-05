const path = require("path");
const { fork } = require("child_process");
const express = require("express");

const db = require("../services/db");
const { MODELS, submitModel } = require("../services/higgsfield");

const router = express.Router();

function startPollingWorker(id, requestId) {
  const workerPath = path.join(__dirname, "..", "workers", "upscalePoller.js");
  const child = fork(workerPath, [String(id), requestId], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}

router.post("/upscale", async (req, res) => {
  const videoUrl = String(req.body.videoUrl || "").trim();
  const model = String(req.body.model || "").trim();
  const resolution = String(req.body.resolution || "").trim();
  const userId = Number(req.body?.userId);
  const selected = MODELS[model];

  if (!Number.isInteger(userId) || userId <= 0) {
    return res.status(400).json({ success: false, message: "userId is required in JSON body" });
  }
  if (!videoUrl.startsWith("https://")) {
    return res.status(400).json({ success: false, message: "videoUrl must be an https URL" });
  }
  if (!selected) {
    return res.status(400).json({
      success: false,
      message: "model must be bytedance, flux3, or topaz",
    });
  }

  const apiResolution = selected.resolutions[resolution];
  if (!apiResolution) {
    return res.status(400).json({
      success: false,
      message: `${model} supports: ${Object.keys(selected.resolutions).join(", ")}`,
    });
  }

  try {
    const submitted = await submitModel(selected, videoUrl, apiResolution);
    const requestId = submitted.request_id;

    const [insert] = await db.execute(
      `INSERT INTO explainerVideo
        (userId, name, sourceUrl, outputUrl, model, requestId, resolution, stage, status, settings, created, modified)
       VALUES (?, ?, ?, NULL, ?, ?, ?, 'processing', 1, ?, NOW(), NOW())`,
      [
        userId,
        "Video Upscale",
        videoUrl,
        model,
        requestId,
        resolution,
        JSON.stringify({ model, resolution, endpoint: submitted.endpoint }),
      ]
    );

    startPollingWorker(insert.insertId, requestId);

    return res.status(202).json({
      success: true,
      id: insert.insertId,
      requestId,
      videoUrl,
      status: 1,
      stage: "processing",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
