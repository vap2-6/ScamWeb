// Turns analyzed posts and clusters into structured intelligence reports ready
// for review before submission to cybercrime authorities (e.g., cybercrime.gov.in / I4C).
// This NEVER auto-submits — it compiles organized evidence dossiers.

export function formatClusterReport(cluster = {}) {
  const {
    clusterId = `clust-${Date.now()}`,
    sharedIdentifier = { type: "unknown", value: "none" },
    posts = [],
    combinedRiskScore = 0,
    allIdentifiers = [],
  } = cluster;

  // Extract unique categories
  const categories = [...new Set(posts.map((p) => p.analysis?.category || "UNKNOWN"))];

  // Extract unique red flags
  const redFlags = [...new Set(posts.flatMap((p) => p.analysis?.red_flags || []))];

  // Consolidate payment rails & communications across all posts
  const paymentRails = [
    ...new Set(
      posts.flatMap((p) => p.analysis?.extracted_payment_info || [])
    ),
  ];

  const communicationChannels = [
    ...new Set(
      posts.flatMap((p) => (p.analysis?.extracted_links || []).filter((l) => /t\.me|@|wa\.me/i.test(l)))
    ),
  ];

  const webDomains = [
    ...new Set(
      posts.flatMap((p) => (p.analysis?.extracted_links || []).filter((l) => /^https?:\/\//i.test(l)))
    ),
  ];

  const flaggedThreatUrls = [
    ...new Set(
      posts.flatMap((p) => p.safe_browsing?.flaggedUrls || [])
    ),
  ];

  const severity = combinedRiskScore >= 80 ? "CRITICAL" : combinedRiskScore >= 50 ? "HIGH" : "MEDIUM";

  return {
    report_id: `RPT-${clusterId.toUpperCase()}-${Date.now()}`,
    generated_at: new Date().toISOString(),
    report_type: "SCAM_SYNDICATE_DOSSIER",
    cluster_summary: {
      cluster_id: clusterId,
      shared_identifier: sharedIdentifier,
      total_linked_posts: posts.length,
      combined_risk_score: combinedRiskScore,
      severity,
      primary_categories: categories,
      aggregated_red_flags: redFlags,
    },
    actionable_threat_infrastructure: {
      payment_rails_to_freeze: paymentRails,
      communication_channels: communicationChannels,
      web_domains: webDomains,
      google_safe_browsing_flagged: flaggedThreatUrls,
    },
    evidence_chain: posts.map((p, idx) => ({
      index: idx + 1,
      post_id: p.id,
      source_url: p.source_url || "(not provided)",
      caption: p.caption || "(empty)",
      ocr_text: p.ocrText || p.ocr_text || "(empty)",
      risk_score: p.analysis?.risk_score ?? 0,
      category: p.analysis?.category ?? "UNKNOWN",
      reasoning: p.analysis?.reasoning ?? "",
      red_flags: p.analysis?.red_flags ?? [],
    })),
    recommended_actions: [
      paymentRails.length > 0
        ? `Submit immediate freeze/lien requests for UPI IDs / accounts: ${paymentRails.join(", ")} via NCRP/I4C portal.`
        : "Verify any hidden payment handles in ad media or OCR text.",
      communicationChannels.length > 0
        ? `Report coordinated fraudulent communication channels (${communicationChannels.join(", ")}) for platform deplatforming.`
        : "Monitor associated accounts for external links.",
      flaggedThreatUrls.length > 0
        ? `Issue rapid takedown notices for verified malicious URLs: ${flaggedThreatUrls.join(", ")}.`
        : "Perform continuous Safe Browsing and WHOIS surveillance on domains.",
    ],
    disclaimer:
      "This report was compiled by an automated AI pipeline for evidence " +
      "organization purposes only. It does not identify or assert the " +
      "identity of any individual. A human reviewer must verify all fields " +
      "before submitting to law enforcement or platform trust & safety teams.",
  };
}

export function formatSinglePostReport(post, analysis, safeBrowsingResult) {
  return {
    report_id: `RPT-${post.id}-${Date.now()}`,
    generated_at: new Date().toISOString(),
    report_type: "SINGLE_INCIDENT_REPORT",
    source: {
      platform: "Instagram/Social Ad",
      post_url: post.source_url || "(not provided)",
      collected_at: post.collected_at || new Date().toISOString(),
    },
    classification: {
      category: analysis?.category || "UNKNOWN",
      risk_score: analysis?.risk_score || 0,
      red_flags: analysis?.red_flags || [],
      reasoning: analysis?.reasoning || "",
    },
    evidence: {
      caption: post.caption,
      ocr_text: post.ocrText || post.ocr_text,
      extracted_links: analysis?.extracted_links || [],
      extracted_payment_info: analysis?.extracted_payment_info || [],
      threat_intel: safeBrowsingResult?.checked
        ? {
            provider: "Google Safe Browsing",
            flagged_urls: safeBrowsingResult.flaggedUrls || [],
          }
        : { provider: "Google Safe Browsing", note: "not checked" },
    },
    disclaimer:
      "This report was compiled by an automated system for evidence " +
      "organization purposes only. A human reviewer should verify all " +
      "fields before submission to the relevant authority.",
  };
}
