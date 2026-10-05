require("dotenv").config();

const db = require("../services/db");
const { waitForVideo } = require("../services/higgsfield");

async function run() {
  const id = Number(process.argv[2]);
  const requestId = process.argv[3];

  if (!Number.isInteger(id) || id <= 0 || !requestId) {
    throw new Error("Worker requires id and requestId");
  }

  try {
    const outputUrl = await waitForVideo(requestId);
    await db.execute(
      `UPDATE explainerVideo
       SET outputUrl = ?, stage = 'completed', status = 2, modified = NOW()
       WHERE id = ?`,
      [outputUrl, id]
    );
    process.exit(0);
  } catch (error) {
    await db.execute(
      `UPDATE explainerVideo
       SET errorMessage = ?, stage = 'failed', status = 3, modified = NOW()
       WHERE id = ?`,
      [error.message, id]
    );
    process.exit(1);
  }
}

run().finally(() => db.end());
