// Builds entity-relationship graph representations (nodes and edges)
// to visualize scam syndicates and shared infrastructure.

export function buildGraphFromAnalysis(post) {
  const nodes = [];
  const edges = [];

  const postId = post.id || `post-${Date.now()}`;
  const analysis = post.analysis || {};
  const links = analysis.extracted_links || [];
  const paymentInfo = analysis.extracted_payment_info || [];

  // Post node
  nodes.push({
    id: `post:${postId}`,
    type: "post",
    label: postId,
    category: analysis.category || "UNKNOWN",
    risk_score: analysis.risk_score || 0,
    source_url: post.source_url || "",
  });

  // Payment nodes & edges
  paymentInfo.forEach((pay) => {
    const payNodeId = `payment:${pay.trim().toLowerCase()}`;
    if (!nodes.some((n) => n.id === payNodeId)) {
      nodes.push({
        id: payNodeId,
        type: "payment",
        label: pay,
      });
    }
    edges.push({
      source: `post:${postId}`,
      target: payNodeId,
      relationship: "USES_PAYMENT",
    });
  });

  const whoisDomains = post.whois?.domains || [];

  // Link/handle nodes & edges
  links.forEach((link) => {
    const linkNodeId = `link:${link.trim().toLowerCase()}`;
    const matchedWhois = whoisDomains.find(
      (d) => d.domain && link.toLowerCase().includes(d.domain.toLowerCase())
    );

    if (!nodes.some((n) => n.id === linkNodeId)) {
      nodes.push({
        id: linkNodeId,
        type: "link",
        label: link,
        domain_age_days: matchedWhois?.ageInDays ?? null,
        is_newly_registered: matchedWhois?.isNewlyRegistered ?? false,
        whois_risk: matchedWhois?.riskLevel ?? null,
        whois_registrar: matchedWhois?.registrar ?? null,
      });
    }
    edges.push({
      source: `post:${postId}`,
      target: linkNodeId,
      relationship: "REFERENCES_LINK",
    });
  });

  return { nodes, edges };
}

export function buildClusterGraph(posts = []) {
  const nodeMap = new Map();
  const edges = [];

  posts.forEach((post) => {
    const subGraph = buildGraphFromAnalysis(post);
    subGraph.nodes.forEach((n) => {
      if (!nodeMap.has(n.id)) {
        nodeMap.set(n.id, n);
      }
    });
    edges.push(...subGraph.edges);
  });

  return {
    nodes: Array.from(nodeMap.values()),
    edges,
  };
}
