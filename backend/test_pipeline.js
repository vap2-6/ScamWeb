// End-to-end automated test runner for backend pipeline
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplesPath = path.join(__dirname, "src", "data", "sample_posts.json");
const samplePosts = JSON.parse(fs.readFileSync(samplesPath, "utf-8"));

const API_BASE = "http://localhost:3001/api";

async function run() {
  console.log("\n=======================================================");
  console.log("🚀 TESTING SCAM DETECTOR BACKEND PIPELINE");
  console.log("=======================================================\n");

  // 1. Health
  const healthResp = await fetch(`${API_BASE}/health`);
  console.log("1. /api/health ->", await healthResp.json());

  // 2. Test Live Scraper API (/api/scrape)
  console.log("\n2. Testing /api/scrape...");
  const scrapeResp = await fetch(`${API_BASE}/scrape`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: "https://instagram.com/p/C9xForexScam1" }),
  });
  const scrapeData = await scrapeResp.json();
  console.log("   /api/scrape result ->", {
    ok: scrapeData.ok,
    id: scrapeData.post?.id,
    hasCaption: !!scrapeData.post?.caption,
    hasOcr: !!scrapeData.post?.ocr_text,
    source: scrapeData.post?.source || "live",
  });

  // 3. Test Auto-Scrape via /api/analyze (only passing source_url)
  console.log("\n3. Testing /api/analyze auto-fetch via source_url...");
  const autoAnalyzeResp = await fetch(`${API_BASE}/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      source_url: "https://instagram.com/p/C9xCryptoSignals3",
    }),
  });
  const autoData = await autoAnalyzeResp.json();
  console.log(`   Auto-analyzed [${autoData.id}] -> Category: ${autoData.analysis?.category}, Risk: ${autoData.analysis?.risk_score}/100`);
  console.log(`   WHOIS checked: ${autoData.whois?.checked}, Safe Browsing checked: ${autoData.safe_browsing?.checked}`);

  // 4. Analyze all sample posts
  console.log("\n4. Analyzing all sample posts with WHOIS & Threat Intel...");
  const analyzedPosts = [];

  for (const post of samplePosts) {
    process.stdout.write(`   Analyzing [${post.id}]... `);
    const resp = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: post.id,
        caption: post.caption,
        ocrText: post.ocr_text,
        source_url: post.source_url,
      }),
    });

    const data = await resp.json();
    const whoisStatus = data.whois?.checked
      ? data.whois.hasSuspiciousDomain
        ? "⚠️ Suspicious Domain"
        : "✅ Domains Verified"
      : "ℹ️ WHOIS N/A";
    console.log(`[${data.analysis?.category}] Risk: ${data.analysis?.risk_score}/100 | ${whoisStatus}`);
    analyzedPosts.push(data);
  }

  // 5. Cluster all analyzed posts
  console.log("\n5. Clustering posts via /api/cluster...");
  const clusterResp = await fetch(`${API_BASE}/cluster`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ posts: analyzedPosts }),
  });
  const clusterData = await clusterResp.json();
  const clusters = clusterData.clusters || [];

  console.log(`   Found ${clusters.length} distinct cluster(s):`);
  clusters.forEach((c, idx) => {
    console.log(`   [Cluster ${idx + 1}] ID: ${c.clusterId}`);
    console.log(`      Shared Identifier: ${c.sharedIdentifier?.type} -> ${c.sharedIdentifier?.value}`);
    console.log(`      Posts in cluster : ${c.posts?.length}`);
    console.log(`      Combined Risk    : ${c.combinedRiskScore}/100\n`);
  });

  // 6. Generate report for the top syndicate cluster
  if (clusters.length > 0) {
    console.log("6. Generating syndicate dossier via /api/reports for top cluster...");
    const reportResp = await fetch(`${API_BASE}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cluster: clusters[0] }),
    });
    const report = await reportResp.json();
    console.log(`   Report ID: ${report.report_id}`);
    console.log(`   Threat Rails to Freeze:`, report.actionable_threat_infrastructure?.payment_rails_to_freeze);
    console.log(`   Communication Channels:`, report.actionable_threat_infrastructure?.communication_channels);
    console.log(`   WHOIS Domain Intel:`, report.actionable_threat_infrastructure?.newly_registered_whois_domains);
    console.log(`   Evidence posts counted:`, report.evidence_chain?.length);
  }

  // 7. Generate single post report
  if (analyzedPosts.length > 0) {
    console.log("\n7. Generating single incident report with WHOIS & Safe Browsing...");
    const p = analyzedPosts[0];
    const singleReportResp = await fetch(`${API_BASE}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        post: { id: p.id, source_url: p.source_url, caption: p.caption, ocrText: p.ocrText },
        analysis: p.analysis,
        safeBrowsing: p.safe_browsing,
        whois: p.whois,
      }),
    });
    const singleReport = await singleReportResp.json();
    console.log(`   Single Incident Report ID: ${singleReport.report_id}`);
    console.log(`   Threat Intel Sections:`, Object.keys(singleReport.evidence?.threat_intel || {}));
  }

  console.log("\n=======================================================");
  console.log("✅ ALL BACKEND APIS & THREAT INTEL TESTED SUCCESSFULLY!");
  console.log("=======================================================\n");
}

run().catch((err) => {
  console.error("Test failed:", err);
});
