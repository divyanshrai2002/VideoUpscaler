const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");

dotenv.config();

const upscaleRouter = require("./routes/upscale");
const videosRouter = require("./routes/videos");

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api", upscaleRouter);
app.use("/api", videosRouter);

app.listen(process.env.PORT || 6008, "0.0.0.0", () => {
  console.log(`Upscale API on http://localhost:${process.env.PORT || 6008}`);
});
