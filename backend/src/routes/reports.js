import { Router } from "express";
import { formatReport } from "../utils/reportFormatter.js";

const router = Router();

// POST /api/reports
// body: { post: {...}, analysis: {...}, safeBrowsing: {...} }
// Returns a formatted report object. Frontend handles download/copy —
// this endpoint does NOT submit anywhere, by design.
router.post("/", (req, res) => {
  const { post, analysis, safeBrowsing } = req.body;

  if (!post || !analysis) {
    return res.status(400).json({ error: "post and analysis are required" });
  }

  const report = formatReport(post, analysis, safeBrowsing);
  res.json(report);
});

export default router;
