const API_BASE = "http://localhost:3001/api";

const analyzeBtn = document.getElementById("analyzeBtn");
const resultsDiv = document.getElementById("results");
const statusEl = document.getElementById("status");

analyzeBtn.addEventListener("click", async () => {
  const caption = document.getElementById("caption").value.trim();
  const ocrText = document.getElementById("ocrText").value.trim();
  const source_url = document.getElementById("sourceUrl").value.trim();

  if (!caption && !ocrText) {
    statusEl.textContent = "Enter a caption or OCR text first.";
    return;
  }

  statusEl.textContent = "Analyzing...";
  analyzeBtn.disabled = true;

  try {
    const id = `post-${Date.now()}`;
    const resp = await fetch(`${API_BASE}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, caption, ocrText, source_url }),
    });

    if (!resp.ok) throw new Error((await resp.json()).error || "Request failed");

    const data = await resp.json();
    renderResult(data, { id, caption, ocrText, source_url });
    statusEl.textContent = "";
  } catch (err) {
    statusEl.textContent = `Error: ${err.message}`;
  } finally {
    analyzeBtn.disabled = false;
  }
});

function riskClass(score) {
  if (score >= 70) return "risk-high";
  if (score >= 40) return "risk-mid";
  return "risk-low";
}

function renderResult(data, post) {
  const { analysis, safe_browsing } = data;

  const card = document.createElement("div");
  card.className = `card ${riskClass(analysis.risk_score)}`;
  card.innerHTML = `
    <h3>${analysis.category} — risk ${analysis.risk_score}/100</h3>
    <p>${analysis.reasoning || ""}</p>
    <div>${(analysis.red_flags || []).map((f) => `<span class="tag">${f}</span>`).join("")}</div>
    <p><strong>Links:</strong> ${(analysis.extracted_links || []).join(", ") || "none found"}</p>
    <p><strong>Payment info:</strong> ${(analysis.extracted_payment_info || []).join(", ") || "none found"}</p>
    <p><strong>Safe Browsing:</strong> ${
      safe_browsing?.checked
        ? safe_browsing.flaggedUrls.length
          ? `flagged: ${safe_browsing.flaggedUrls.join(", ")}`
          : "no known threats matched"
        : "not checked (add SAFE_BROWSING_API_KEY)"
    }</p>
    <button class="genReportBtn">Generate report</button>
    <pre class="reportOutput" style="display:none"></pre>
  `;

  const genBtn = card.querySelector(".genReportBtn");
  const reportOutput = card.querySelector(".reportOutput");

  genBtn.addEventListener("click", async () => {
    const resp = await fetch(`${API_BASE}/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ post, analysis, safeBrowsing: safe_browsing }),
    });
    const report = await resp.json();
    reportOutput.textContent = JSON.stringify(report, null, 2);
    reportOutput.style.display = "block";
  });

  resultsDiv.prepend(card);
}
