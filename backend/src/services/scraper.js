// [OPTIONAL / STRETCH] Live Instagram fetch.
// Only attempt this if the core pipeline (sample dataset -> classifier ->
// dashboard -> report) is fully working with time to spare.
//
// Instagram has no simple free public-ad API for arbitrary accounts.
// Realistic free-tier options, roughly in order of effort:
//   1. Manual: keep adding screenshots/captions to sample_posts.json as
//      you find them — this is what most teams should actually do.
//   2. Instagram Basic Display / Graph API — only works for content on
//      accounts you control, not arbitrary public ads. Not useful here.
//   3. A headless-browser scraper (Puppeteer) against public post URLs —
//      fragile, breaks often, real risk of the scraping account getting
//      rate-limited or banned mid-demo. Only do this as a video-recorded
//      fallback, never live during judging.
//
// Gate every call site behind process.env.ENABLE_LIVE_SCRAPING === "true".

export async function fetchPostByUrl(postUrl) {
  if (process.env.ENABLE_LIVE_SCRAPING !== "true") {
    throw new Error(
      "Live scraping disabled. Add posts to sample_posts.json instead, " +
        "or set ENABLE_LIVE_SCRAPING=true once you've built + tested a scraper."
    );
  }

  // Placeholder shape for whatever scraping approach you land on.
  // Keep the return shape identical to a sample_posts.json entry so it
  // drops straight into the existing pipeline with no changes downstream.
  throw new Error("fetchPostByUrl not implemented yet — see comments above");

  // return {
  //   id: "...",
  //   source_url: postUrl,
  //   caption: "...",
  //   ocr_text: "...",
  //   image_url: "...",
  //   collected_at: new Date().toISOString(),
  // };
}
