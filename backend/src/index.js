import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import analyzeRouter from "./routes/analyze.js";
import reportsRouter from "./routes/reports.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/analyze", analyzeRouter);
app.use("/api/reports", reportsRouter);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`scam-detector backend running on http://localhost:${PORT}`);
});
