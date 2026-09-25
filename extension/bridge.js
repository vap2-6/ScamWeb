/**
 * ScamWeb Extension Bridge
 * Runs on ScamWeb dashboard (localhost:3001) to automatically sync
 * generated forensic dossiers into chrome.storage.local for cybercrime.gov.in.
 */

(function () {
  console.log("[ScamWeb Extension] Bridge content script initialized.");

  // Broadcast to page that extension is present
  window.postMessage({ type: "SCAMWEB_EXTENSION_READY", version: "1.0.0" }, "*");

  // Listen for reports generated in dashboard
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === "SCAMWEB_REPORT_PAYLOAD") {
      const payload = event.data.payload;
      if (payload) {
        chrome.storage.local.set({ scamweb_latest_report: payload }, () => {
          console.log("[ScamWeb Extension] Stored latest report in chrome.storage:", payload.report_id);
          window.postMessage({ type: "SCAMWEB_STORAGE_SYNCED", report_id: payload.report_id }, "*");
        });
      }
    }
  });

  // Check if localStorage has an existing active report from earlier
  try {
    const cached = localStorage.getItem("scamweb_latest_payload");
    if (cached) {
      const parsed = JSON.parse(cached);
      chrome.storage.local.set({ scamweb_latest_report: parsed });
    }
  } catch (e) {
    // ignore
  }
})();
