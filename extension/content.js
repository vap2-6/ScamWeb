/**
 * ScamWeb Autofill — Chrome Manifest V3 Content Script
 * Operates strictly on cybercrime.gov.in complaint forms.
 *
 * GUARANTEES:
 * 1. Discovers fields via inspected ASP.NET IDs, names, and label text.
 * 2. Autofills category, description, URLs, payment rails, and timestamp.
 * 3. Highlights all filled fields with a subtle #01E8BC outline.
 * 4. NEVER clicks submit. Ever. User retains 100% manual review & control.
 */

(function () {
  console.log("[ScamWeb Autofill] Content script loaded on:", window.location.href);

  // State
  let activePayload = null;
  let filledFieldsCount = 0;
  const highlightedElements = [];

  // Initialize
  init();

  async function init() {
    // 1. Try reading from chrome.storage
    activePayload = await readPayloadFromStorage();

    // 2. If not found in storage, attempt reading from clipboard
    if (!activePayload) {
      activePayload = await readPayloadFromClipboard();
    }

    // 3. Render top banner (even if waiting for user payload paste)
    renderTopBanner(activePayload);

    // 4. If payload exists, attempt autofill
    if (activePayload) {
      autofillForm(activePayload);
    }
  }

  /* ==========================================================================
     PAYLOAD RETRIEVAL
     ========================================================================== */
  function readPayloadFromStorage() {
    return new Promise((resolve) => {
      if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(["scamweb_latest_report"], (res) => {
          if (res && res.scamweb_latest_report) {
            console.log("[ScamWeb] Loaded report from chrome.storage:", res.scamweb_latest_report.report_id);
            resolve(res.scamweb_latest_report);
          } else {
            resolve(null);
          }
        });
      } else {
        resolve(null);
      }
    });
  }

  async function readPayloadFromClipboard() {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim().startsWith("{")) {
          const parsed = JSON.parse(text);
          if (parsed && (parsed.scamweb_payload || parsed.report_id)) {
            console.log("[ScamWeb] Detected valid ScamWeb payload from clipboard.");
            return parsed;
          }
        }
      }
    } catch (e) {
      // Clipboard permission might require user gesture
    }
    return null;
  }

  /* ==========================================================================
     FIELD DETECTION & AUTOFILL ENGINE
     Discovers ASP.NET WebForms controls, modern inputs, and semantic labels
     ========================================================================== */
  function autofillForm(payload) {
    if (!payload) return;

    filledFieldsCount = 0;
    clearHighlights();

    const normalizedData = extractNormalizedData(payload);
    console.log("[ScamWeb] Normalized forensic data to fill:", normalizedData);

    // Query all potential form controls
    const inputs = Array.from(document.querySelectorAll("input, textarea, select"));

    inputs.forEach((el) => {
      // Skip hidden, disabled, or button inputs
      if (el.type === "hidden" || el.type === "submit" || el.type === "button" || el.type === "image") return;
      if (el.disabled || el.readOnly) return;

      const descriptor = getElementDescriptor(el);

      // 1. INCIDENT DESCRIPTION / DETAILS (textarea / text)
      if (matchesField(descriptor, [
        "incidentdetails", "txtincidentdetails", "txtdescription", "txtbrief",
        "txtbrieffacts", "description", "incident_description", "modusoperandi", "brief facts"
      ])) {
        fillValue(el, normalizedData.incidentDescription);
        return;
      }

      // 2. CATEGORY (select / dropdown)
      if (el.tagName === "SELECT" && matchesField(descriptor, [
        "ddlcategory", "category", "crimecategory", "ddlcrimecategory", "nature of crime"
      ])) {
        fillSelectOption(el, ["financial", "online financial fraud", "fraud", "scam", "social media"]);
        return;
      }

      // 3. SUB-CATEGORY (select / dropdown)
      if (el.tagName === "SELECT" && matchesField(descriptor, [
        "ddlsubcategory", "subcategory", "sub_category", "sub category"
      ])) {
        fillSelectOption(el, ["upi", "upi fraud", "job fraud", "investment", "financial", "impersonation"]);
        return;
      }

      // 4. SUSPECT WEBSITES / URLS
      if (matchesField(descriptor, [
        "txtsuspectwebsite", "txt_suspect_url", "txtwebsite", "txturl",
        "txtsuspectsocialmedia", "txt_webphishing", "lnk_webphishing", "website", "social media url", "phishing"
      ])) {
        if (normalizedData.urls.length > 0) {
          fillValue(el, normalizedData.urls.join(", "));
        }
        return;
      }

      // 5. PAYMENT HANDLES (UPI / Bank Accounts)
      if (matchesField(descriptor, [
        "txtsuspectupi", "txtupiid", "txt_upi", "txtsuspectaccount", "txtaccountno",
        "txtwallet", "txtbankname", "upi", "bank account", "wallet", "payment handle"
      ])) {
        if (normalizedData.paymentHandles.length > 0) {
          fillValue(el, normalizedData.paymentHandles.join(", "));
        }
        return;
      }

      // 6. SUSPECT TELEGRAM / WHATSAPP / SOCIAL MEDIA
      if (matchesField(descriptor, [
        "txttelegram", "txtwhatsapp", "txtsuspecttelegram", "lnkwhatsapp", "telegram", "whatsapp"
      ])) {
        if (normalizedData.channels.length > 0) {
          fillValue(el, normalizedData.channels.join(", "));
        }
        return;
      }

      // 7. SUSPECT PHONE / MOBILE
      if (matchesField(descriptor, [
        "txtsuspectmobile", "txtmobile", "txtphone", "suspectnumber", "mobile number", "phone number"
      ])) {
        if (normalizedData.phoneNumbers.length > 0) {
          fillValue(el, normalizedData.phoneNumbers[0]);
        }
        return;
      }

      // 8. INCIDENT DATE
      if (matchesField(descriptor, [
        "txtincidentdate", "txt_date", "txtdate", "incident_date", "date of incident", "incident date"
      ])) {
        fillValue(el, el.type === "date" ? normalizedData.isoDate : normalizedData.formattedDate);
        return;
      }

      // 9. INCIDENT TIME
      if (matchesField(descriptor, [
        "txtincidenttime", "txt_time", "txttime", "incident_time", "time of incident", "incident time"
      ])) {
        fillValue(el, normalizedData.formattedTime);
        return;
      }
    });

    updateBannerStats(normalizedData);
  }

  /* ==========================================================================
     DESCRIPTOR & MATCHING HELPERS
     ========================================================================== */
  function getElementDescriptor(el) {
    const parts = [
      el.id || "",
      el.name || "",
      el.getAttribute("placeholder") || "",
      el.getAttribute("aria-label") || ""
    ];

    // Find linked label
    if (el.id) {
      const label = document.querySelector(`label[for="${CSS.escape(el.id)}"]`);
      if (label) parts.push(label.textContent || "");
    }

    // Find parent label
    const parentLabel = el.closest("label");
    if (parentLabel) parts.push(parentLabel.textContent || "");

    // Check table cell predecessor (standard ASP.NET pattern: <td>Label:</td><td><input></td>)
    const td = el.closest("td");
    if (td && td.previousElementSibling) {
      parts.push(td.previousElementSibling.textContent || "");
    }

    // Check parent div label
    const formGroup = el.closest(".form-group, .form-row, .col, .mb-3, tr");
    if (formGroup) {
      const groupLabel = formGroup.querySelector("label, .control-label, .col-form-label, th, td.label");
      if (groupLabel && groupLabel !== el) {
        parts.push(groupLabel.textContent || "");
      }
    }

    return parts.join(" ").toLowerCase().replace(/[^a-z0-9_\s]/g, " ");
  }

  function matchesField(descriptor, keywords) {
    return keywords.some((k) => descriptor.includes(k.toLowerCase()));
  }

  function fillValue(el, value) {
    if (!value || el.value === value) return;

    el.value = value;
    el.classList.add("scamweb-autofilled");
    highlightedElements.push(el);

    // Add subtle indicator tag if not already present
    if (!el.parentNode.querySelector(".scamweb-field-badge")) {
      const badge = document.createElement("span");
      badge.className = "scamweb-field-badge";
      badge.textContent = "✓ Autofilled by ScamWeb";
      el.parentNode.insertBefore(badge, el.nextSibling);
    }

    // Dispatch synthetic input/change events for client validation
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));

    filledFieldsCount++;
  }

  function fillSelectOption(selectEl, keywords) {
    let matched = false;
    for (let i = 0; i < selectEl.options.length; i++) {
      const opt = selectEl.options[i];
      const optText = (opt.text + " " + opt.value).toLowerCase();
      if (keywords.some((k) => optText.includes(k))) {
        selectEl.selectedIndex = i;
        selectEl.classList.add("scamweb-autofilled");
        highlightedElements.push(selectEl);

        selectEl.dispatchEvent(new Event("change", { bubbles: true }));
        selectEl.dispatchEvent(new Event("blur", { bubbles: true }));

        matched = true;
        filledFieldsCount++;
        break;
      }
    }
    return matched;
  }

  function clearHighlights() {
    highlightedElements.forEach((el) => {
      el.classList.remove("scamweb-autofilled");
    });
    document.querySelectorAll(".scamweb-field-badge").forEach((b) => b.remove());
    highlightedElements.length = 0;
  }

  /* ==========================================================================
     FORENSIC DATA NORMALIZATION & COMPLIANCE SANITIZATION
     ========================================================================== */
  function extractNormalizedData(payload) {
    const summary = payload.cluster_summary || payload.classification || {};
    const infra = payload.actionable_threat_infrastructure || {};
    const payments = infra.payment_rails_to_freeze || payload.evidence?.extracted_payment_info || [];
    const channels = infra.communication_channels || [];
    const domains = infra.web_domains || payload.evidence?.extracted_links || [];

    const dateObj = payload.generated_at ? new Date(payload.generated_at) : new Date();

    // Indian Date Format DD/MM/YYYY
    const dd = String(dateObj.getDate()).padStart(2, "0");
    const mm = String(dateObj.getMonth() + 1).padStart(2, "0");
    const yyyy = dateObj.getFullYear();
    const formattedDate = `${dd}/${mm}/${yyyy}`;
    const isoDate = `${yyyy}-${mm}-${dd}`;

    // 24hr Time HH:MM
    const hours = String(dateObj.getHours()).padStart(2, "0");
    const minutes = String(dateObj.getMinutes()).padStart(2, "0");
    const formattedTime = `${hours}:${minutes}`;

    // Cybercrime.gov.in strictly forbids @, #, $, %, ^, *, ~, | in description.
    // We sanitize these characters while maintaining clear forensic facts.
    let descriptionNarrative = `
INCIDENT REPORT DETAILS (ScamWeb Forensic Case: ${payload.report_id || "SCAM-CASE"})
Intake Date: ${formattedDate} at ${formattedTime} IST.
Assessed Threat Severity: ${summary.combined_risk_score || summary.risk_score || 95} of 100.

MODUS OPERANDI:
The victim encountered fraudulent sponsored advertisements and social posts offering unrealistic financial returns and illicit investment schemes. The perpetrators directed prospective targets off-platform to unverified communication channels to solicit upfront advance payments.

TARGET PAYMENT IDENTIFIERS TO FREEZE:
${payments.length > 0 ? payments.map((p, i) => `Payment Rail [${i + 1}]: ${p.replace(/@/g, " at ")}`).join("\n") : "No direct bank or UPI text handles identified in initial intake."}

COMMUNICATION HANDLES AND PHISHING URLS:
${channels.concat(domains).length > 0 ? channels.concat(domains).map(c => `- ${c.replace(/@/g, " at ")}`).join("\n") : "- None detected."}

RECOMMENDED ACTION:
Request immediate banking lien placement under Section 66D IT Act on the identified payment rails and preserve subscriber logs for linked communication channels.
`.trim();

    // Sanitize any remaining restricted symbols
    descriptionNarrative = descriptionNarrative
      .replace(/@/g, " at ")
      .replace(/#/g, "No. ")
      .replace(/[$%^*|~]/g, " ")
      .replace(/\s{2,}/g, " ");

    return {
      reportId: payload.report_id || "SCAM-CASE",
      category: summary.category || "Online Financial Fraud",
      incidentDescription: descriptionNarrative,
      urls: domains.concat(channels.filter(c => c.startsWith("http"))),
      paymentHandles: payments,
      channels: channels,
      phoneNumbers: payload.evidence?.extracted_phones || [],
      formattedDate,
      isoDate,
      formattedTime
    };
  }

  /* ==========================================================================
     TOP BANNER UI
     Visible banner strictly adhering to user instructions:
     "Fields autofilled by ScamWeb — please review before submitting."
     ========================================================================== */
  function renderTopBanner(payload) {
    if (document.getElementById("scamweb-autofill-banner")) return;

    document.body.classList.add("scamweb-banner-active");

    const banner = document.createElement("div");
    banner.id = "scamweb-autofill-banner";
    banner.innerHTML = `
      <div class="scamweb-banner-inner">
        <div class="scamweb-banner-left">
          <span class="scamweb-banner-badge">ScamWeb Forensics</span>
          <div class="scamweb-banner-title-group">
            <span class="scamweb-banner-title">Fields autofilled by ScamWeb — please review before submitting.</span>
            <span class="scamweb-banner-subtitle">ScamWeb never automatically submits complaint forms. Verify all fields before final submission.</span>
          </div>
        </div>

        <div class="scamweb-banner-stats" id="scamwebBannerStats">
          ${payload ? `
            <div class="scamweb-stat-pill">Case: <strong>${payload.report_id || "Active"}</strong></div>
            <div class="scamweb-stat-pill">Fields filled: <strong id="scamwebFilledCount">0</strong></div>
          ` : `
            <div class="scamweb-stat-pill" style="color: #FFB84D;">No case loaded in storage</div>
          `}
        </div>

        <div class="scamweb-banner-actions">
          ${payload ? `
            <button type="button" class="scamweb-banner-btn" id="scamwebRefillBtn">Re-fill fields</button>
            <button type="button" class="scamweb-banner-btn" id="scamwebClearBtn">Clear highlights</button>
          ` : `
            <button type="button" class="scamweb-banner-btn primary" id="scamwebPasteBtn">Paste ScamWeb Payload</button>
          `}
          <button type="button" class="scamweb-banner-close" id="scamwebCloseBannerBtn" title="Dismiss banner">&times;</button>
        </div>
      </div>
    `;

    document.body.insertBefore(banner, document.body.firstChild);

    // Event handlers
    const closeBtn = banner.querySelector("#scamwebCloseBannerBtn");
    closeBtn.addEventListener("click", () => {
      banner.remove();
      document.body.classList.remove("scamweb-banner-active");
    });

    const refillBtn = banner.querySelector("#scamwebRefillBtn");
    if (refillBtn) {
      refillBtn.addEventListener("click", () => {
        if (activePayload) autofillForm(activePayload);
      });
    }

    const clearBtn = banner.querySelector("#scamwebClearBtn");
    if (clearBtn) {
      clearBtn.addEventListener("click", () => {
        clearHighlights();
        const countSpan = document.getElementById("scamwebFilledCount");
        if (countSpan) countSpan.textContent = "0 (cleared)";
      });
    }

    const pasteBtn = banner.querySelector("#scamwebPasteBtn");
    if (pasteBtn) {
      pasteBtn.addEventListener("click", () => {
        showManualPayloadModal();
      });
    }
  }

  function updateBannerStats(normalizedData) {
    const countSpan = document.getElementById("scamwebFilledCount");
    if (countSpan) {
      countSpan.textContent = String(filledFieldsCount);
    }
  }

  function showManualPayloadModal() {
    if (document.getElementById("scamweb-payload-modal")) return;

    const modal = document.createElement("div");
    modal.id = "scamweb-payload-modal";
    modal.innerHTML = `
      <div class="scamweb-modal-box">
        <h3>Paste ScamWeb Case Payload</h3>
        <p>Paste the JSON payload or copied case text from your ScamWeb dashboard below to autofill this complaint form.</p>
        <textarea id="scamwebPayloadText" placeholder="Paste { ... } or case report text here..."></textarea>
        <div class="scamweb-modal-actions">
          <button type="button" class="scamweb-banner-btn" id="scamwebModalCancel">Cancel</button>
          <button type="button" class="scamweb-banner-btn primary" id="scamwebModalApply">Autofill Form</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    modal.querySelector("#scamwebModalCancel").addEventListener("click", () => modal.remove());
    modal.querySelector("#scamwebModalApply").addEventListener("click", () => {
      const val = modal.querySelector("#scamwebPayloadText").value.trim();
      if (!val) return;

      try {
        let parsed = null;
        if (val.startsWith("{")) {
          parsed = JSON.parse(val);
        } else {
          // Fallback parser for plain text dossier
          parsed = {
            report_id: "MANUAL-INTAKE",
            cluster_summary: { category: "Online Financial Fraud", risk_score: 95 },
            actionable_threat_infrastructure: {
              payment_rails_to_freeze: [...val.matchAll(/[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g)].map(m => m[0]),
              communication_channels: [...val.matchAll(/@([a-zA-Z0-9_]{4,32})/g)].map(m => m[0]),
              web_domains: [...val.matchAll(/https?:\/\/[^\s]+/g)].map(m => m[0])
            }
          };
        }

        activePayload = parsed;
        modal.remove();

        // Save to chrome.storage
        if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) {
          chrome.storage.local.set({ scamweb_latest_report: parsed });
        }

        autofillForm(activePayload);

        // Update banner UI
        const banner = document.getElementById("scamweb-autofill-banner");
        if (banner) banner.remove();
        renderTopBanner(activePayload);
        updateBannerStats();
      } catch (err) {
        alert("Invalid JSON payload: " + err.message);
      }
    });
  }
})();
