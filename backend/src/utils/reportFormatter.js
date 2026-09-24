// Turns an analyzed post into a structured report ready for human review
// before submission to cybercrime.gov.in (India) or the equivalent
// authority. This NEVER auto-submits — it only formats for a human to
// review, copy, and file themselves.

export function formatReport(post, analysis, safeBrowsingResult) {
  return {
    report_id: `RPT-${post.id}-${Date.now()}`,
    generated_at: new Date().toISOString(),
    source: {
      platform: "Instagram",
      post_url: post.source_url || "(not provided)",
      collected_at: post.collected_at,
    },
    classification: {
      category: analysis.category,
      risk_score: analysis.risk_score,
      red_flags: analysis.red_flags,
      reasoning: analysis.reasoning,
    },
    evidence: {
      caption: post.caption,
      ocr_text: post.ocr_text,
      extracted_links: analysis.extracted_links,
      extracted_payment_info: analysis.extracted_payment_info,
      threat_intel: safeBrowsingResult?.checked
        ? {
            provider: "Google Safe Browsing",
            flagged_urls: safeBrowsingResult.flaggedUrls,
          }
        : { provider: "Google Safe Browsing", note: "not checked" },
    },
    disclaimer:
      "This report was compiled by an automated system for evidence " +
      "organization purposes only. It does not identify or assert the " +
      "identity of any individual. A human reviewer should verify all " +
      "fields before submission to the relevant authority.",
  };
}
