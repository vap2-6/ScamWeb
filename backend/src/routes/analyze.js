import { Router } from "express";
import { classifyPost } from "../services/classifier.js";
import { extractLinksAndPaymentInfo } from "../services/linkExtractor.js";
import { checkUrlsAgainstSafeBrowsing } from "../services/safeBrowsing.js";

const router = Router();

// POST /api/analyze
// body: { id, caption, ocrText, source_url? }
router.post("/", async (req, res) => {
  const { id, caption = "", ocrText = "", source_url = "" } = req.body;

  if (!caption && !ocrText) {
    return res.status(400).json({ error: "caption or ocrText is required" });
  }

  try {
    const analysis = await classifyPost({ caption, ocrText });

    // Merge LLM-extracted links with regex backup, dedupe
    const regexExtracted = extractLinksAndPaymentInfo(`${caption} ${ocrText}`);
    const allUrls = [
      ...new Set([...(analysis.extracted_links ?? []), ...regexExtracted.urls]),
    ];

    const safeBrowsingResult = await checkUrlsAgainstSafeBrowsing(allUrls);

    res.json({
      id,
      source_url,
      analysis: { ...analysis, extracted_links: allUrls },
      regex_backup: regexExtracted,
      safe_browsing: safeBrowsingResult,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
