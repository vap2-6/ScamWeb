import { Router } from "express";
import { fetchPostByUrl } from "../services/scraper.js";

const router = Router();

// POST /api/scrape
// request:  { url: "https://www.instagram.com/p/..." } or { postUrl: "..." }
// response: { ok: true, post: { id, source_url, caption, ocr_text, image_url, collected_at } }
router.post("/", async (req, res) => {
  const postUrl = req.body.url || req.body.postUrl || req.body.source_url;

  if (!postUrl) {
    return res.status(400).json({
      error: "url or postUrl is required (e.g. https://www.instagram.com/p/C9xForexScam1)",
    });
  }

  try {
    const post = await fetchPostByUrl(postUrl);
    res.json({ ok: true, post });
  } catch (err) {
    console.error("Scrape error:", err.message);
    res.status(500).json({
      error: err.message || "Failed to scrape Instagram post",
    });
  }
});

export default router;
