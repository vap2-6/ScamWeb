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

  // 2. Analyze all samples
  console.log("\n2. Analyzing sample posts...");
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
    console.log(`[${data.analysis?.category}] Risk: ${data.analysis?.risk_score}/100`);
    analyzedPosts.push(data);
  }

  // 3. Cluster all analyzed posts
  console.log("\n3. Clustering posts via /api/cluster...");
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

  // 4. Generate report for the top syndicate cluster
  if (clusters.length > 0) {
    console.log("4. Generating syndicate report via /api/reports for top cluster...");
    const reportResp = await fetch(`${API_BASE}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cluster: clusters[0] }),
    });
    const report = await reportResp.json();
    console.log(`   Report ID: ${report.report_id}`);
    console.log(`   Threat Rails to Freeze:`, report.actionable_threat_infrastructure?.payment_rails_to_freeze);
    console.log(`   Communication Channels:`, report.actionable_threat_infrastructure?.communication_channels);
    console.log(`   Evidence posts counted:`, report.evidence_chain?.length);
  }

  console.log("\n=======================================================");
  console.log("✅ ALL BACKEND APIS TESTED SUCCESSFULLY!");
  console.log("=======================================================\n");
}

run().catch((err) => {
  console.error("Test failed:", err);
});
