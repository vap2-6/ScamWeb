// Live Instagram post fetcher and OCR extractor.
//
// Gate every call site behind process.env.ENABLE_LIVE_SCRAPING === "true".
//
// Extracts:
// - Post caption
// - Image URL
// - OCR extracted text from the image (via Gemini Vision if GEMINI_API_KEY is available)
// - Post author & canonical source URL
//
// Returns identical data shape to sample_posts.json entries:
// { id, source_url, caption, ocr_text, image_url, collected_at }

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Normalizes an Instagram URL or shortcode to extract the post shortcode
 */
export function extractInstagramShortcode(urlOrCode = "") {
  if (!urlOrCode || typeof urlOrCode !== "string") return null;

  const trimmed = urlOrCode.trim();

  // If it's an Instagram URL
  const urlMatch = trimmed.match(/(?:instagram\.com\/(?:p|reel|tv)\/|instagr\.am\/p\/)([A-Za-z0-9_-]+)/i);
  if (urlMatch) return urlMatch[1];

  // If it's just a bare shortcode (without slashes or domains)
  if (!trimmed.includes("/") && !trimmed.includes(".")) {
    const rawMatch = trimmed.match(/^[A-Za-z0-9_-]{5,35}$/);
    if (rawMatch) return rawMatch[0];
  }

  return null;
}

/**
 * Checks sample_posts.json for local fixture / sample matches.
 * Essential for hackathon reliability if offline or if Instagram rate-limits.
 */
function findInSamplePosts(urlOrCode) {
  try {
    const samplesPath = path.join(__dirname, "..", "data", "sample_posts.json");
    if (!fs.existsSync(samplesPath)) return null;

    const samples = JSON.parse(fs.readFileSync(samplesPath, "utf-8"));
    const shortcode = extractInstagramShortcode(urlOrCode);

    return samples.find((s) => {
      const sampleCode = extractInstagramShortcode(s.source_url || s.id);
      if (shortcode && sampleCode && shortcode.toLowerCase() === sampleCode.toLowerCase()) {
        return true;
      }
      if (s.source_url && urlOrCode && s.source_url.toLowerCase() === urlOrCode.toLowerCase()) {
        return true;
      }
      if (s.id && urlOrCode && s.id.toLowerCase() === urlOrCode.toLowerCase()) {
        return true;
      }
      return false;
    });
  } catch (err) {
    console.warn("Failed to check sample posts cache:", err.message);
    return null;
  }
}

/**
 * Strips HTML tags and unescapes basic HTML entities
 */
function cleanHtmlText(raw = "") {
  return raw
    .replace(/<br\s*[\/]?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extracts visible text from an image URL using Gemini 3.6 Flash (Vision)
 */
async function performImageOcr(imageUrl) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || !imageUrl || !imageUrl.startsWith("http")) {
    return "";
  }

  try {
    const imgResp = await fetch(imageUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      signal: AbortSignal.timeout(5000),
    });

    if (!imgResp.ok) return "";

    const contentType = imgResp.headers.get("content-type") || "image/jpeg";
    const arrayBuffer = await imgResp.arrayBuffer();
    const base64Data = Buffer.from(arrayBuffer).toString("base64");

    const geminiResp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text:
                    "Extract all readable text, URLs, Telegram handles, and payment info verbatim from this advertisement image via OCR. Return only the extracted text. If no text exists, reply NONE.",
                },
                {
                  inlineData: {
                    mimeType: contentType.includes("png") ? "image/png" : "image/jpeg",
                    data: base64Data,
                  },
                },
              ],
            },
          ],
        }),
      }
    );

    if (!geminiResp.ok) return "";

    const data = await geminiResp.json();
    const ocrText = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
    return ocrText.toUpperCase() === "NONE" ? "" : ocrText;
  } catch (err) {
    console.warn("Gemini Vision OCR extraction failed:", err.message);
    return "";
  }
}

/**
 * Strategy 1: Fetch via Social Crawler User-Agent (OpenGraph / Meta parsing)
 */
async function scrapeViaOpenGraph(shortcode) {
  const postUrl = `https://www.instagram.com/p/${shortcode}/`;
  const resp = await fetch(postUrl, {
    headers: {
      "User-Agent": "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(5000),
  });

  if (!resp.ok) {
    throw new Error(`OpenGraph fetch returned status ${resp.status}`);
  }

  const html = await resp.text();

  // Extract meta og:description
  // Often formatted as: "123 Likes, 45 Comments - Username (@handle) on Instagram: \"Caption here...\""
  const ogDescMatch =
    html.match(/<meta\s+(?:property|name)="og:description"\s+content="([^"]*)"/i) ||
    html.match(/content="([^"]*)"\s+(?:property|name)="og:description"/i) ||
    html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);

  let caption = "";
  if (ogDescMatch) {
    const rawDesc = cleanHtmlText(ogDescMatch[1]);
    // Extract text inside the final quotation marks if present
    const quoteMatch = rawDesc.match(/:\s*["“]([\s\S]+?)["”]$/);
    caption = quoteMatch ? quoteMatch[1] : rawDesc;
  }

  // Extract meta og:image
  const ogImgMatch =
    html.match(/<meta\s+(?:property|name)="og:image"\s+content="([^"]*)"/i) ||
    html.match(/content="([^"]*)"\s+(?:property|name)="og:image"/i) ||
    html.match(/<meta\s+property="twitter:image"\s+content="([^"]*)"/i);

  const imageUrl = ogImgMatch ? ogImgMatch[1].replace(/&amp;/g, "&") : "";

  // Extract author
  const ogTitleMatch =
    html.match(/<meta\s+(?:property|name)="og:title"\s+content="([^"]*)"/i) ||
    html.match(/content="([^"]*)"\s+(?:property|name)="og:title"/i);
  let author = "";
  if (ogTitleMatch) {
    const authorMatch = ogTitleMatch[1].match(/^([^•|\-(\]]+)/);
    author = authorMatch ? authorMatch[1].trim() : ogTitleMatch[1];
  }

  if (!caption && !imageUrl) {
    throw new Error("No caption or image found via OpenGraph metadata");
  }

  return { caption, imageUrl, author, method: "OpenGraph" };
}

/**
 * Strategy 2: Fetch via Instagram Public Embed endpoint
 */
async function scrapeViaEmbed(shortcode) {
  const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/captioned/`;
  const resp = await fetch(embedUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(5000),
  });

  if (!resp.ok) {
    throw new Error(`Embed fetch returned status ${resp.status}`);
  }

  const html = await resp.text();

  // Check for broken media notice
  if (html.includes("The link to this photo or video may be broken")) {
    throw new Error("Instagram post may be removed or unavailable");
  }

  // Extract caption from Caption container or JS payload
  let caption = "";
  const captionMatch = html.match(/<div class="Caption"[^>]*>([\s\S]*?)<\/div>/i);
  if (captionMatch) {
    caption = cleanHtmlText(captionMatch[1]);
  } else {
    // Search for caption text strings in hydrated JSON scripts
    const textMatches = html.match(/"text":"([^"\\]*(?:\\.[^"\\]*)*)"/g);
    if (textMatches && textMatches.length > 0) {
      for (const m of textMatches) {
        const parsed = JSON.parse(`{${m}}`);
        if (parsed.text && parsed.text.length > 20 && !parsed.text.startsWith("http")) {
          caption = parsed.text;
          break;
        }
      }
    }
  }

  // Extract image
  let imageUrl = "";
  const imgTagMatch = html.match(/<img[^>]+class="[^"]*EmbeddedMediaImage[^"]*"[^>]+src="([^">]+)"/i);
  if (imgTagMatch) {
    imageUrl = imgTagMatch[1].replace(/&amp;/g, "&");
  } else {
    // Search for cdninstagram image URL in script tags
    const cdnMatch = html.match(/https:\\\/\\\/[^"'\s]+cdninstagram\.com[^"'\s]+/);
    if (cdnMatch) {
      imageUrl = cdnMatch[0].replace(/\\\//g, "/").replace(/\\u0026/g, "&");
    }
  }

  // Extract author username
  const userMatch = html.match(/class="CaptionUsername"[^>]*>([^<]+)<\/a>/i);
  const author = userMatch ? userMatch[1].trim() : "";

  if (!caption && !imageUrl) {
    throw new Error("No caption or image extracted from embed page");
  }

  return { caption, imageUrl, author, method: "Embed" };
}

/**
 * Strategy 3: Authenticated fetch using Instagram session cookie (if configured)
 */
async function scrapeViaSessionCookie(shortcode) {
  const cookie = process.env.INSTAGRAM_COOKIE || process.env.INSTAGRAM_SESSION_ID;
  if (!cookie) return null;

  const cookieHeader = cookie.includes("sessionid=") ? cookie : `sessionid=${cookie}`;
  const apiUrl = `https://www.instagram.com/p/${shortcode}/?__a=1&__d=dis`;

  const resp = await fetch(apiUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Cookie": cookieHeader,
      "X-Requested-With": "XMLHttpRequest",
    },
    signal: AbortSignal.timeout(5000),
  });

  if (!resp.ok) return null;

  const data = await resp.json();
  const media = data?.graphql?.shortcode_media || data?.items?.[0];
  if (!media) return null;

  const caption =
    media.edge_media_to_caption?.edges?.[0]?.node?.text || media.caption?.text || "";
  const imageUrl = media.display_url || media.image_versions2?.candidates?.[0]?.url || "";
  const author = media.owner?.username || media.user?.username || "";

  return { caption, imageUrl, author, method: "AuthenticatedAPI" };
}

/**
 * Main live scraper entrypoint.
 *
 * @param {string} postUrl - Instagram post URL or shortcode
 * @returns {Promise<{id: string, source_url: string, caption: string, ocr_text: string, image_url: string, collected_at: string}>}
 */
export async function fetchPostByUrl(postUrl) {
  if (process.env.ENABLE_LIVE_SCRAPING !== "true") {
    throw new Error(
      "Live scraping disabled. Set ENABLE_LIVE_SCRAPING=true in backend/.env to enable live Instagram post fetching."
    );
  }

  if (!postUrl || typeof postUrl !== "string") {
    throw new Error("Instagram post URL or identifier is required.");
  }

  // 1. Check local sample fixtures first for deterministic hackathon demo testing
  const matchedSample = findInSamplePosts(postUrl);
  if (matchedSample) {
    return {
      ...matchedSample,
      live_scraped: false,
      source: "sample_cache",
    };
  }

  // 2. Extract shortcode
  const shortcode = extractInstagramShortcode(postUrl);
  if (!shortcode) {
    throw new Error(`Unable to extract valid Instagram post shortcode from "${postUrl}".`);
  }

  const canonicalUrl = `https://www.instagram.com/p/${shortcode}/`;
  let scraped = null;
  const errors = [];

  // 3. Try Authenticated API if cookie is provided
  try {
    scraped = await scrapeViaSessionCookie(shortcode);
  } catch (err) {
    errors.push(`Session cookie: ${err.message}`);
  }

  // 4. Try OpenGraph / Social Crawler strategy
  if (!scraped) {
    try {
      scraped = await scrapeViaOpenGraph(shortcode);
    } catch (err) {
      errors.push(`OpenGraph: ${err.message}`);
    }
  }

  // 5. Try Embed Page strategy
  if (!scraped) {
    try {
      scraped = await scrapeViaEmbed(shortcode);
    } catch (err) {
      errors.push(`Embed: ${err.message}`);
    }
  }

  // If live strategies failed, provide descriptive error
  if (!scraped || (!scraped.caption && !scraped.imageUrl)) {
    throw new Error(
      `Failed to scrape Instagram post [${shortcode}] live. Errors: ${errors.join("; ")}. ` +
        `Note: Instagram may require login for this specific post. You can paste the caption directly or add to sample_posts.json.`
    );
  }

  // 6. Perform OCR on image if an image was recovered and Gemini is available
  let ocrText = "";
  if (scraped.imageUrl) {
    ocrText = await performImageOcr(scraped.imageUrl);
  }

  return {
    id: `ig-${shortcode}`,
    source_url: canonicalUrl,
    caption: scraped.caption || "",
    ocr_text: ocrText,
    image_url: scraped.imageUrl || "",
    author: scraped.author || "",
    collected_at: new Date().toISOString(),
    live_scraped: true,
    scraper_method: scraped.method,
  };
}
