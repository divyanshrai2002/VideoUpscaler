const express = require("express");

const db = require("../services/db");

const router = express.Router();

function toVideo(row) {
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

router.post("/videos", async (req, res) => {
  try {
    const userId = req.body?.userId;
    const filterByUser = userId !== undefined && userId !== null && userId !== "";
    const [rows] = await db.execute(
      `SELECT id, userId, name, sourceUrl, outputUrl, model, resolution, requestId, errorMessage, stage, status, created, modified
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
      `SELECT id, userId, name, sourceUrl, outputUrl, model, resolution, requestId, errorMessage, stage, status, created, modified
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
