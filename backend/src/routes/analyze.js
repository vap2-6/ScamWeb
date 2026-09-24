import { Router } from "express";
import { classifyPost } from "../services/classifier.js";
import { extractLinksAndPaymentInfo } from "../services/linkExtractor.js";
import { checkUrlsAgainstSafeBrowsing } from "../services/safeBrowsing.js";
import { buildGraphFromAnalysis } from "../utils/graphBuilder.js";

const router = Router();

// POST /api/analyze
// request:  { id, caption, ocrText, source_url }
// response: { id, analysis: { category, risk_score, red_flags, extracted_links, extracted_payment_info, reasoning }, safe_browsing: {...} }
router.post("/", async (req, res) => {
  const { id = `post-${Date.now()}`, caption = "", ocrText = "", source_url = "" } = req.body;

  if (!caption && !ocrText) {
    return res.status(400).json({ error: "caption or ocrText is required" });
  }

  try {
    const analysis = await classifyPost({ caption, ocrText });

    // Extract links & payment info using regex as fallback & supplement
    const regexExtracted = extractLinksAndPaymentInfo(`${caption} ${ocrText}`);

    // Merge & dedupe links and telegram handles
    const allLinks = [
      ...new Set([
        ...(analysis.extracted_links ?? []),
        ...regexExtracted.urls,
        ...regexExtracted.telegramHandles,
      ]),
    ];

    // Merge & dedupe payment information (UPI IDs, bank details)
    const allPaymentInfo = [
      ...new Set([
        ...(analysis.extracted_payment_info ?? []),
        ...regexExtracted.possibleUpiIds,
      ]),
    ];

    const finalAnalysis = {
      category: analysis.category ?? "UNKNOWN",
      risk_score: analysis.risk_score ?? 0,
      red_flags: analysis.red_flags ?? [],
      extracted_links: allLinks,
      extracted_payment_info: allPaymentInfo,
      reasoning: analysis.reasoning ?? "",
    };

    // Filter only actual HTTP/HTTPS URLs for Safe Browsing lookup
    const httpUrls = allLinks.filter((link) => /^https?:\/\//i.test(link));
    const safeBrowsingResult = await checkUrlsAgainstSafeBrowsing(httpUrls);

    // Entity-relationship graph for visual analysis
    const postPayload = { id, source_url, caption, ocrText, analysis: finalAnalysis };
    const graph = buildGraphFromAnalysis(postPayload);

    res.json({
      id,
      source_url,
      caption,
      ocrText,
      analysis: finalAnalysis,
      safe_browsing: safeBrowsingResult,
      graph,
    });
  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({ error: err.message || "Failed to analyze post" });
  }
});

export default router;
