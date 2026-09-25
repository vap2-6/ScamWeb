import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import analyzeRouter from "./routes/analyze.js";
import clusterRouter from "./routes/cluster.js";
import reportsRouter from "./routes/reports.js";
import scrapeRouter from "./routes/scrape.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

// Serve frontend static assets
app.use(express.static(path.join(__dirname, "../../frontend")));
app.use("/extension", express.static(path.join(__dirname, "../../extension")));

// Parse JSON bodies
app.use(express.json({ limit: "5mb" }));

// Also parse raw/text bodies in case tools (like Postman VS Code extension) send text/plain
app.use(express.text({ type: "*/*", limit: "5mb" }));

// Universal JSON body normalizer
app.use((req, res, next) => {
  if (typeof req.body === "string" && req.body.trim().startsWith("{")) {
    try {
      req.body = JSON.parse(req.body);
    } catch (err) {
      // not JSON string, leave as is
    }
  }
  next();
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/analyze", analyzeRouter);
app.use("/api/cluster", clusterRouter);
app.use("/api/reports", reportsRouter);
app.use("/api/scrape", scrapeRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`scam-detector backend running on http://localhost:${PORT}`);
});
