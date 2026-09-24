import { buildClusterGraph } from "../utils/graphBuilder.js";

/**
 * Normalizes an identifier (payment handle, telegram, domain, phone)
 * into a consistent key for cross-post matching.
 */
function normalizeIdentifier(val, typeHint = "") {
  if (!val || typeof val !== "string") return null;
  const cleaned = val.trim().toLowerCase();

  // Telegram handles: @handle or t.me/handle -> tg:handle
  if (cleaned.includes("t.me/") || cleaned.startsWith("@")) {
    const handle = cleaned.replace(/^.*t\.me\//, "").replace(/^@/, "").split("/")[0].split("?")[0];
    if (handle) return { type: "telegram", key: `tg:${handle}`, display: `@${handle}` };
  }

  // UPI IDs: something@bank
  if (cleaned.includes("@") && !cleaned.startsWith("http")) {
    return { type: "upi", key: `upi:${cleaned}`, display: cleaned };
  }

  // URLs: extract hostname/domain or path
  if (/^https?:\/\//i.test(cleaned)) {
    try {
      const urlObj = new URL(cleaned);
      const host = urlObj.hostname.replace(/^www\./, "");
      // For URL shorteners or telegram, keep path
      if (["bit.ly", "tinyurl.com", "t.me", "wa.me"].includes(host)) {
        return { type: "shortlink", key: `url:${host}${urlObj.pathname}`, display: `${host}${urlObj.pathname}` };
      }
      return { type: "domain", key: `domain:${host}`, display: host };
    } catch {
      return { type: "link", key: `link:${cleaned}`, display: cleaned };
    }
  }

  // Phone / WhatsApp
  const digits = cleaned.replace(/\D/g, "");
  if (digits.length >= 10 && digits.length <= 13) {
    return { type: "phone", key: `phone:${digits.slice(-10)}`, display: digits };
  }

  if (typeHint === "payment") {
    return { type: "payment", key: `pay:${cleaned}`, display: cleaned };
  }

  return { type: "generic", key: `gen:${cleaned}`, display: cleaned };
}

/**
 * Disjoint Set Union (DSU) for connected component clustering.
 */
class UnionFind {
  constructor(size) {
    this.parent = Array.from({ length: size }, (_, i) => i);
  }

  find(i) {
    if (this.parent[i] === i) return i;
    this.parent[i] = this.find(this.parent[i]);
    return this.parent[i];
  }

  union(i, j) {
    const rootI = this.find(i);
    const rootJ = this.find(j);
    if (rootI !== rootJ) {
      this.parent[rootI] = rootJ;
      return true;
    }
    return false;
  }
}

/**
 * Clusters analyzed posts by shared identifiers (UPI IDs, phone numbers,
 * Telegram handles, URLs, and payment accounts).
 *
 * @param {Array} posts - Array of analyze responses
 * @returns {Array} Array of clusters: { clusterId, sharedIdentifier, posts, combinedRiskScore, graph }
 */
export function clusterAnalyzedPosts(posts = []) {
  if (!Array.isArray(posts) || posts.length === 0) {
    return [];
  }

  const n = posts.length;
  const uf = new UnionFind(n);

  // Map identifier key -> array of post indices
  const identifierToPostIndices = new Map();
  // Map identifier key -> metadata { type, display }
  const identifierMeta = new Map();
  // Map post index -> array of normalized identifiers
  const postIdentifiers = Array.from({ length: n }, () => []);

  posts.forEach((post, idx) => {
    const analysis = post.analysis || {};
    const links = analysis.extracted_links || post.extracted_links || [];
    const payments = analysis.extracted_payment_info || post.extracted_payment_info || [];

    const extracted = [];

    payments.forEach((p) => {
      const norm = normalizeIdentifier(p, "payment");
      if (norm) extracted.push(norm);
    });

    links.forEach((l) => {
      const norm = normalizeIdentifier(l, "link");
      if (norm) extracted.push(norm);
    });

    extracted.forEach((item) => {
      postIdentifiers[idx].push(item);
      if (!identifierToPostIndices.has(item.key)) {
        identifierToPostIndices.set(item.key, []);
        identifierMeta.set(item.key, item);
      }
      identifierToPostIndices.get(item.key).push(idx);
    });
  });

  // Union posts that share any identifier
  for (const [, indices] of identifierToPostIndices.entries()) {
    for (let i = 1; i < indices.length; i++) {
      uf.union(indices[0], indices[i]);
    }
  }

  // Group posts by root representative
  const rootGroups = new Map();
  for (let i = 0; i < n; i++) {
    const root = uf.find(i);
    if (!rootGroups.has(root)) {
      rootGroups.set(root, []);
    }
    rootGroups.get(root).push(i);
  }

  // Format clusters
  const clusters = [];
  let clusterCounter = 1;

  for (const [, memberIndices] of rootGroups.entries()) {
    const clusterPosts = memberIndices.map((i) => posts[i]);

    // Find all identifiers present in this cluster
    const clusterIdentMap = new Map();
    memberIndices.forEach((i) => {
      postIdentifiers[i].forEach((item) => {
        const count = (clusterIdentMap.get(item.key)?.count || 0) + 1;
        clusterIdentMap.set(item.key, { ...item, count });
      });
    });

    // Identify shared identifiers (present in >= 2 posts, or highest priority if singleton)
    const sortedIdents = Array.from(clusterIdentMap.values()).sort((a, b) => {
      // Prefer items shared across more posts
      if (b.count !== a.count) return b.count - a.count;
      // Prefer payment over telegram over domain
      const priority = { upi: 4, payment: 4, telegram: 3, shortlink: 2, domain: 1, phone: 3 };
      return (priority[b.type] || 0) - (priority[a.type] || 0);
    });

    let primaryShared = null;
    if (sortedIdents.length > 0) {
      const top = sortedIdents[0];
      primaryShared = {
        type: top.type,
        value: top.display,
        sharedAcrossCount: top.count,
      };
    } else {
      primaryShared = {
        type: "none",
        value: "Unconnected post",
        sharedAcrossCount: 1,
      };
    }

    // Compute combined risk score
    // Aggregates individual scores with escalation for multi-post syndicates
    const scores = clusterPosts.map((p) => {
      return p.analysis?.risk_score ?? p.risk_score ?? 0;
    });
    const maxScore = Math.max(...scores, 0);
    const avgScore = scores.reduce((sum, s) => sum + s, 0) / (scores.length || 1);

    // Multi-post syndicate bonus (evidence of coordinated campaign)
    const syndicateMultiplier = clusterPosts.length > 1 ? Math.min(25, (clusterPosts.length - 1) * 8) : 0;
    const combinedRiskScore = Math.min(100, Math.round(Math.max(maxScore, avgScore + 5) + syndicateMultiplier));

    const safeSlug = primaryShared.value
      ? primaryShared.value.replace(/[^a-zA-Z0-9]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 20)
      : `group-${clusterCounter}`;

    const clusterId = `cluster-${primaryShared.type}-${safeSlug || clusterCounter}`;
    clusterCounter++;

    clusters.push({
      clusterId,
      sharedIdentifier: primaryShared,
      allIdentifiers: sortedIdents.map((si) => ({ type: si.type, value: si.display, count: si.count })),
      posts: clusterPosts,
      combinedRiskScore,
      graph: buildClusterGraph(clusterPosts),
    });
  }

  // Sort clusters by combinedRiskScore descending
  clusters.sort((a, b) => b.combinedRiskScore - a.combinedRiskScore);

  return clusters;
}
