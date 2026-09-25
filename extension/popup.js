document.addEventListener("DOMContentLoaded", () => {
  const caseId = document.getElementById("caseId");
  const caseCategory = document.getElementById("caseCategory");
  const caseRisk = document.getElementById("caseRisk");
  const casePayments = document.getElementById("casePayments");
  const openPortalBtn = document.getElementById("openPortalBtn");
  const pastePayloadBtn = document.getElementById("pastePayloadBtn");

  // Load from chrome.storage
  chrome.storage.local.get(["scamweb_latest_report"], (res) => {
    if (res && res.scamweb_latest_report) {
      displayReport(res.scamweb_latest_report);
    } else {
      caseId.textContent = "No case loaded";
      caseCategory.textContent = "Generate in ScamWeb";
      caseRisk.textContent = "-";
      casePayments.textContent = "-";
    }
  });

  function displayReport(report) {
    const summary = report.cluster_summary || report.classification || {};
    const infra = report.actionable_threat_infrastructure || {};
    const payments = infra.payment_rails_to_freeze || report.evidence?.extracted_payment_info || [];

    caseId.textContent = report.report_id || "Active Case";
    caseCategory.textContent = summary.category || "Financial Fraud";
    caseRisk.textContent = `${summary.combined_risk_score || summary.risk_score || 95}/100`;
    casePayments.textContent = payments.length > 0 ? `${payments.length} identified` : "None";
  }

  openPortalBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://cybercrime.gov.in/Webform/cyber_suspect.aspx" });
  });

  pastePayloadBtn.addEventListener("click", async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().startsWith("{")) {
        const payload = JSON.parse(text);
        chrome.storage.local.set({ scamweb_latest_report: payload }, () => {
          displayReport(payload);
          pastePayloadBtn.textContent = "✓ Payload Loaded!";
          setTimeout(() => {
            pastePayloadBtn.textContent = "Paste Clipboard Payload";
          }, 2000);
        });
      } else {
        alert("Clipboard does not contain valid ScamWeb JSON payload.");
      }
    } catch (e) {
      alert("Unable to read clipboard. Please allow clipboard permissions.");
    }
  });
});
