import { Router } from "express";
import { classifyPost } from "../services/classifier.js";
import { extractLinksAndPaymentInfo } from "../services/linkExtractor.js";
import { checkUrlsAgainstSafeBrowsing } from "../services/safeBrowsing.js";
import { checkDomainsAge } from "../services/whois.js";
import { fetchPostByUrl } from "../services/scraper.js";
import { buildGraphFromAnalysis } from "../utils/graphBuilder.js";

const router = Router();

// POST /api/analyze
// request:  { id, caption, ocrText, source_url, postUrl }
// response: { id, source_url, caption, ocrText, image_url, analysis: {...}, safe_browsing: {...}, whois: {...}, graph: {...} }
router.post("/", async (req, res) => {
  let {
    id = `post-${Date.now()}`,
    caption = "",
    ocrText = "",
    source_url = "",
    postUrl = "",
    image_url = "",
  } = req.body;

  const targetUrl = source_url || postUrl;

  try {
    // If caption and ocrText are missing, but an Instagram URL is provided,
    // attempt live scraping via scraper.js
    if (!caption && !ocrText && targetUrl) {
      if (process.env.ENABLE_LIVE_SCRAPING === "true") {
        try {
          const scraped = await fetchPostByUrl(targetUrl);
          caption = scraped.caption || "";
          ocrText = scraped.ocr_text || "";
          image_url = scraped.image_url || image_url;
          source_url = scraped.source_url || targetUrl;
          if (scraped.id && id.startsWith("post-")) {
            id = scraped.id;
          }
        } catch (scrapeErr) {
          console.warn(`Live scrape attempt for ${targetUrl} failed:`, scrapeErr.message);
          return res.status(400).json({
            error: `Failed to scrape Instagram post: ${scrapeErr.message}. Please enter caption manually.`,
          });
        }
      } else {
        return res.status(400).json({
          error:
            "caption or ocrText is required. Live scraping is currently disabled (set ENABLE_LIVE_SCRAPING=true).",
        });
      }
    }

    if (!caption && !ocrText) {
      return res.status(400).json({ error: "caption or ocrText is required" });
    }

    // Classify content using Gemini LLM (with heuristic fallback)
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
      red_flags: [...(analysis.red_flags ?? [])],
      extracted_links: allLinks,
      extracted_payment_info: allPaymentInfo,
      reasoning: analysis.reasoning ?? "",
    };

    // Filter only actual HTTP/HTTPS URLs for threat intel lookups
    const httpUrls = allLinks.filter((link) => /^https?:\/\//i.test(link));

    // 1. Google Safe Browsing threat check
    const safeBrowsingResult = await checkUrlsAgainstSafeBrowsing(httpUrls);
    if (safeBrowsingResult?.checked && safeBrowsingResult.flaggedUrls?.length > 0) {
      finalAnalysis.risk_score = Math.max(finalAnalysis.risk_score, 95);
      finalAnalysis.red_flags.push(
        `Flagged by Google Safe Browsing: ${safeBrowsingResult.flaggedUrls.join(", ")}`
      );
    }

    // 2. WHOIS / RDAP Domain Age Intelligence check
    const whoisResult = await checkDomainsAge(httpUrls);
    if (whoisResult?.checked && whoisResult.domains?.length > 0) {
      const suspiciousDomains = whoisResult.domains.filter(
        (d) => d.checked && (d.isNewlyRegistered || d.isVeryYoung)
      );

      if (suspiciousDomains.length > 0) {
        suspiciousDomains.forEach((d) => {
          finalAnalysis.red_flags.push(
            `Newly registered domain: ${d.domain} (${d.ageInDays} days old, registered ${d.createdDate ? new Date(d.createdDate).toLocaleDateString() : "recently"} via ${d.registrar || "Unknown"}) — classic disposable scam infrastructure`
          );
        });

        // Boost risk score for newly created scam domains
        finalAnalysis.risk_score = Math.min(
          100,
          Math.max(finalAnalysis.risk_score, 80) + (suspiciousDomains.some((d) => d.isVeryYoung) ? 15 : 10)
        );
      }
    }

    // Deduplicate red flags
    finalAnalysis.red_flags = [...new Set(finalAnalysis.red_flags)];

    // Entity-relationship graph for visual analysis
    const postPayload = {
      id,
      source_url: source_url || targetUrl,
      caption,
      ocrText,
      image_url,
      analysis: finalAnalysis,
      whois: whoisResult,
      safe_browsing: safeBrowsingResult,
    };
    const graph = buildGraphFromAnalysis(postPayload);

    res.json({
      id,
      source_url: source_url || targetUrl,
      caption,
      ocrText,
      image_url,
      analysis: finalAnalysis,
      safe_browsing: safeBrowsingResult,
      whois: whoisResult,
      graph,
    });
  } catch (err) {
    console.error("Analysis error:", err);
    res.status(500).json({ error: err.message || "Failed to analyze post" });
  }
});

export default router;
