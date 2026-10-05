const express = require("express");

const db = require("../services/db");
const { MODELS, submitModel, waitForVideo } = require("../services/higgsfield");

const router = express.Router();

function toVideo(row) {
  let settings = row.settings;
  if (typeof settings === "string") {
    try {
      settings = JSON.parse(settings);
    } catch {
      settings = {};
    }
  }
  row = { ...row, settings: settings || {} };
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    videoUrl: row.sourceUrl,
    outputUrl: row.outputUrl,
    model: row.model,
    resolution: row.resolution,
    requestId: row.requestId,
    errorMessage: row.errorMessage,
    creativityMode: row.settings?.creativityMode || null,
    frameInterpolation: row.settings?.frameInterpolation ?? null,
    stage: row.stage,
    status: row.status,
    created: row.created,
    modified: row.modified,
  };
}

function bodyId(req, res) {
  const id = Number(req.body?.id);
  if (!Number.isInteger(id) || id <= 0) {
    res.status(400).json({ success: false, message: "id is required in JSON body" });
    return null;
  }
  return id;
}

async function processUpscaleInBackground(id, requestId) {
  try {
    const outputUrl = await waitForVideo(requestId);
    await db.execute(
      `UPDATE explainerVideo
       SET outputUrl = ?, stage = 'completed', status = 2, modified = NOW()
       WHERE id = ?`,
      [outputUrl, id]
    );
  } catch (error) {
    console.error(error);
    await db.execute(
      `UPDATE explainerVideo
       SET errorMessage = ?, stage = 'failed', status = 3, modified = NOW()
       WHERE id = ?`,
      [error.message, id]
    );
  }
}

router.post("/upscale", async (req, res) => {
  const videoUrl = String(req.body.videoUrl || "").trim();
  const model = String(req.body.model || "").trim();
  const resolution = String(req.body.resolution || "").trim();
  const userId = Number(req.body?.userId);
  const creativityMode = String(req.body.creativityMode || "subtle").trim().toLowerCase();
  const frameInterpolation = Boolean(req.body.frameInterpolation);
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

  if (!["subtle", "bold"].includes(creativityMode)) {
    return res.status(400).json({
      success: false,
      message: "creativityMode must be subtle or bold",
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
    const submitted = await submitModel(selected, videoUrl, apiResolution, {
      creativityMode,
      frameInterpolation,
    });
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
        JSON.stringify({
          model,
          resolution,
          endpoint: submitted.endpoint,
          creativityMode,
          frameInterpolation,
        }),
      ]
    );

    processUpscaleInBackground(insert.insertId, requestId);

    return res.status(202).json({
      success: true,
      id: insert.insertId,
      requestId,
      videoUrl,
      creativityMode,
      frameInterpolation,
      outputUrl: null,
      status: 1,
      stage: "processing",
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/videos", async (req, res) => {
  try {
    const userId = req.body?.userId;
    const filterByUser = userId !== undefined && userId !== null && userId !== "";
    const [rows] = await db.execute(
      `SELECT id, userId, name, sourceUrl, outputUrl, model, resolution, requestId, errorMessage, settings, stage, status, created, modified
       FROM explainerVideo
       WHERE isDeleted = 0 ${filterByUser ? "AND userId = ?" : ""}
       ORDER BY id DESC`,
      filterByUser ? [Number(userId)] : []
    );
    return res.json({ success: true, videos: rows.map(toVideo) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/videos/get", async (req, res) => {
  try {
    const id = bodyId(req, res);
    if (!id) return;
    const [rows] = await db.execute(
      `SELECT id, userId, name, sourceUrl, outputUrl, model, resolution, requestId, errorMessage, settings, stage, status, created, modified
       FROM explainerVideo
       WHERE id = ? AND isDeleted = 0`,
      [id]
    );
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }
    return res.json({ success: true, video: toVideo(rows[0]) });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

router.post("/videos/delete", async (req, res) => {
  try {
    const id = bodyId(req, res);
    if (!id) return;
    const [result] = await db.execute(
      `UPDATE explainerVideo SET isDeleted = 1, modified = NOW() WHERE id = ? AND isDeleted = 0`,
      [id]
    );
    if (!result.affectedRows) {
      return res.status(404).json({ success: false, message: "Video not found" });
    }
    return res.json({ success: true, id });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
