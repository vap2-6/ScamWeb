import { Router } from "express";
import { formatClusterReport, formatSinglePostReport } from "../utils/reportFormatter.js";

const router = Router();

// POST /api/reports
// Accepts either:
// 1) { cluster: { ... } } -> Generates a comprehensive Syndicate Intelligence Dossier
// 2) { post: {...}, analysis: {...}, safeBrowsing: {...} } -> Generates a single incident report
router.post("/", (req, res) => {
  const { cluster, post, analysis, safeBrowsing, whois } = req.body;

  if (cluster) {
    const report = formatClusterReport(cluster);
    return res.json(report);
  }

  if (post && analysis) {
    const report = formatSinglePostReport(post, analysis, safeBrowsing, whois);
    return res.json(report);
  }

  return res.status(400).json({
    error: "Invalid request. Provide either { cluster: {...} } or { post: {...}, analysis: {...} }",
  });
});

export default router;
