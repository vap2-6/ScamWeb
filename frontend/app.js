/**
 * ScamWeb — Digital Forensics Case File System
 * Pure Vanilla JavaScript (No Frameworks, No Build Step)
 * Sentence Case Throughout | Deliberate 600ms Score Count-Up Motion
 * Color Tokens Strictly Aligned with Logo: #01E8BC
 */

// API Base Resolution: supports direct backend serving (port 3001) or standalone servers
const API_BASE = window.location.origin.includes(":3001") 
  ? "/api" 
  : "http://localhost:3001/api";

// Application State
const state = {
  uploadedFiles: [],        // Array of { id, file, name, size, previewUrl }
  analyzedPosts: [],        // Array of API analyze responses
  clusterResults: [],       // Array of clusters returned from /api/cluster
  activeReport: null,       // Generated report object
  isAnalyzing: false,       // In-flight flag
  statusInterval: null,     // Interval ID for cycling status messages
  reportsArchive: []        // Stored generated reports for session
};

// DOM Elements
const elements = {
  // Navigation
  navScanboard: document.getElementById("nav-scanboard"),
  navOperations: document.getElementById("nav-operations"),
  navReports: document.getElementById("nav-reports"),
  views: {
    scanboard: document.getElementById("view-scanboard"),
    operations: document.getElementById("view-operations"),
    reports: document.getElementById("view-reports"),
  },
  pageTitle: document.getElementById("pageTitle"),
  pageSubtitle: document.getElementById("pageSubtitle"),

  // Input & Upload Zone
  scanInputCard: document.getElementById("scanInputCard"),
  dropZone: document.getElementById("dropZone"),
  fileInput: document.getElementById("fileInput"),
  browseBtn: document.getElementById("browseBtn"),
  thumbnailsGrid: document.getElementById("thumbnailsGrid"),
  textInput: document.getElementById("textInput"),
  charCount: document.getElementById("charCount"),
  analyzeBtn: document.getElementById("analyzeBtn"),
  validationHint: document.getElementById("validationHint"),
  loadDemoBtn: document.getElementById("loadDemoBtn"),

  // In-flight Analyzing State
  analyzingCard: document.getElementById("analyzingCard"),
  analyzingStatus: document.getElementById("analyzingStatus"),

  // Results & Outputs
  resultsWrapper: document.getElementById("resultsWrapper"),
  itemCountBadge: document.getElementById("itemCountBadge"),
  resetScanBtn: document.getElementById("resetScanBtn"),
  analyzedCardsList: document.getElementById("analyzedCardsList"),
  clusterSection: document.getElementById("clusterSection"),
  clusterContainer: document.getElementById("clusterContainer"),
  reportSection: document.getElementById("reportSection"),
  reportContainer: document.getElementById("reportContainer"),

  // Secondary Views
  operationsGrid: document.getElementById("operationsGrid"),
  reportsArchiveList: document.getElementById("reportsArchiveList"),
  toastContainer: document.getElementById("toastContainer"),

  // Theme Toggle
  themeToggleBtn: document.getElementById("themeToggleBtn")
};

const THEME_ICONS = {
  // Moon icon displayed in light mode to switch to dark mode
  moon: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon pointer-events-none"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>`,
  // Sun icon displayed in dark mode to switch to light mode
  sun: `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="theme-icon pointer-events-none"><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></svg>`
};

/* ==========================================================================
   INITIALIZATION
   ========================================================================== */
function init() {
  setupThemeToggle();
  setupNavigation();
  setupUploadZone();
  setupTextInput();
  setupAnalyzeAction();
  setupDemoLoader();

  if (window.lucide) {
    lucide.createIcons();
  }
}

// 0. Theme Toggle (Dark / Light Theme Persistence)
function setupThemeToggle() {
  const { themeToggleBtn } = elements;
  if (!themeToggleBtn) return;

  const savedTheme = localStorage.getItem("scamweb_theme") || "dark";
  applyTheme(savedTheme);

  themeToggleBtn.addEventListener("click", () => {
    const isLight = document.body.classList.contains("light-theme");
    const newTheme = isLight ? "dark" : "light";
    applyTheme(newTheme);
    localStorage.setItem("scamweb_theme", newTheme);
  });
}

function applyTheme(theme) {
  const { themeToggleBtn } = elements;
  if (theme === "light") {
    document.body.classList.add("light-theme");
    document.documentElement.setAttribute("data-theme", "light");
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = THEME_ICONS.moon;
      themeToggleBtn.setAttribute("title", "Switch to dark mode");
      themeToggleBtn.setAttribute("aria-label", "Switch to dark mode");
    }
  } else {
    document.body.classList.remove("light-theme");
    document.documentElement.setAttribute("data-theme", "dark");
    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = THEME_ICONS.sun;
      themeToggleBtn.setAttribute("title", "Switch to light mode");
      themeToggleBtn.setAttribute("aria-label", "Switch to light mode");
    }
  }
}

// 1. Navigation with Sentence Case Titles
function setupNavigation() {
  const navBtns = [elements.navScanboard, elements.navOperations, elements.navReports];

  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const viewKey = btn.dataset.view;

      navBtns.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");

      Object.keys(elements.views).forEach((key) => {
        elements.views[key].classList.toggle("active", key === viewKey);
      });

      if (viewKey === "scanboard") {
        elements.pageTitle.textContent = "Upload & analyze";
        elements.pageSubtitle.textContent = "Evidence processing and syndicate correlation engine";
      } else if (viewKey === "operations") {
        elements.pageTitle.textContent = "Scam operations";
        elements.pageSubtitle.textContent = "Correlated operations linked through shared identifiers";
        renderOperationsView();
      } else if (viewKey === "reports") {
        elements.pageTitle.textContent = "Case files";
        elements.pageSubtitle.textContent = "Archived dossiers formatted for cybercrime.gov.in";
        renderReportsArchiveView();
      }

      if (window.lucide) {
        setTimeout(() => lucide.createIcons(), 20);
      }
    });
  });
}

// 2. Upload Zone: Multi-select & Drag and Drop
function setupUploadZone() {
  const { dropZone, fileInput, browseBtn } = elements;

  browseBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    fileInput.click();
  });

  dropZone.addEventListener("click", () => {
    fileInput.click();
  });

  fileInput.addEventListener("change", (e) => {
    handleFilesSelected(e.target.files);
    fileInput.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add("drag-active");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove("drag-active");
    });
  });

  dropZone.addEventListener("drop", (e) => {
    const dt = e.dataTransfer;
    if (dt && dt.files && dt.files.length > 0) {
      handleFilesSelected(dt.files);
    }
  });
}

function handleFilesSelected(fileList) {
  const allowedTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];

  Array.from(fileList).forEach((file) => {
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      showToast(`Skipped "${file.name}": unsupported format (PNG, JPG, WEBP only).`);
      return;
    }

    const fileId = `ev-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
    const previewUrl = URL.createObjectURL(file);

    state.uploadedFiles.push({
      id: fileId,
      file,
      name: file.name,
      size: formatFileSize(file.size),
      previewUrl
    });
  });

  renderThumbnails();
  updateAnalyzeButtonState();
}

function renderThumbnails() {
  const { thumbnailsGrid } = elements;
  thumbnailsGrid.innerHTML = "";

  if (state.uploadedFiles.length === 0) {
    thumbnailsGrid.style.display = "none";
    return;
  }

  thumbnailsGrid.style.display = "grid";

  state.uploadedFiles.forEach((item) => {
    const card = document.createElement("div");
    card.className = "thumb-card";
    card.innerHTML = `
      <div class="thumb-img-wrapper">
        <img src="${item.previewUrl}" alt="${escapeHtml(item.name)}" class="thumb-img" />
      </div>
      <div class="thumb-details">
        <span class="thumb-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</span>
        <span class="thumb-size">${item.size}</span>
      </div>
      <button class="thumb-remove-btn" type="button" title="Remove evidence item" data-id="${item.id}">×</button>
    `;

    card.querySelector(".thumb-remove-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      removeUploadedFile(item.id);
    });

    thumbnailsGrid.appendChild(card);
  });
}

function removeUploadedFile(fileId) {
  const index = state.uploadedFiles.findIndex((f) => f.id === fileId);
  if (index !== -1) {
    URL.revokeObjectURL(state.uploadedFiles[index].previewUrl);
    state.uploadedFiles.splice(index, 1);
  }
  renderThumbnails();
  updateAnalyzeButtonState();
}

// 3. Single Text Input & Character Counter
function setupTextInput() {
  const { textInput, charCount } = elements;

  textInput.addEventListener("input", () => {
    charCount.textContent = textInput.value.length;
    updateAnalyzeButtonState();
  });
}

function updateAnalyzeButtonState() {
  const hasText = elements.textInput.value.trim().length > 0;
  const hasImages = state.uploadedFiles.length > 0;
  const canAnalyze = hasText || hasImages;

  elements.analyzeBtn.disabled = !canAnalyze || state.isAnalyzing;

  if (canAnalyze) {
    elements.validationHint.innerHTML = `
      <span style="color: var(--accent-teal);">✓</span>
      <span style="color: var(--text-white);">Ready for analysis (${state.uploadedFiles.length} file${state.uploadedFiles.length === 1 ? '' : 's'}, ${hasText ? 'text input present' : 'no text'})</span>
    `;
  } else {
    elements.validationHint.innerHTML = `
      <span class="hint-symbol">•</span>
      <span>Enter suspicious text or attach at least one screenshot to proceed</span>
    `;
  }
}

/* ==========================================================================
   4. ANALYZING FLOW (OCR + BACKEND)
   ========================================================================== */
function setupAnalyzeAction() {
  elements.analyzeBtn.addEventListener("click", executeAnalysis);
  elements.resetScanBtn.addEventListener("click", resetScanboard);
}

async function executeAnalysis() {
  const textContent = elements.textInput.value.trim();
  const files = [...state.uploadedFiles];

  if (!textContent && files.length === 0) return;

  state.isAnalyzing = true;
  updateAnalyzeButtonState();

  elements.scanInputCard.style.display = "none";
  elements.resultsWrapper.style.display = "none";
  elements.analyzingCard.style.display = "flex";

  startStatusAnimation(files.length > 0);

  try {
    const itemsToAnalyze = [];

    // Client-side OCR via Tesseract.js if images attached
    if (files.length > 0) {
      updateStatusMessage("Performing optical character recognition on screenshots...");

      for (let i = 0; i < files.length; i++) {
        const fileObj = files[i];
        let ocrText = "";

        try {
          if (window.Tesseract) {
            updateStatusMessage(`Extracting optical transcript from item ${i + 1} of ${files.length}...`);
            const ocrResult = await Tesseract.recognize(fileObj.file, "eng", {
              logger: (m) => {
                if (m.status === "recognizing text") {
                  const pct = Math.round((m.progress || 0) * 100);
                  updateStatusMessage(`Recognizing text on screenshot ${i + 1} (${pct}%)...`);
                }
              }
            });
            ocrText = (ocrResult?.data?.text || "").trim();
          }
        } catch (ocrErr) {
          console.warn("Client OCR notice:", ocrErr);
        }

        const detectedUrl = extractFirstUrl(textContent);
        const effectiveCaption = textContent || (fileObj.name ? `Evidence screenshot: ${fileObj.name}` : "Evidence screenshot");
        const effectiveOcr = ocrText || (textContent ? "" : "Visual advertisement screenshot attached for inspection");

        itemsToAnalyze.push({
          id: `ev-${Date.now()}-${i + 1}`,
          caption: effectiveCaption,
          ocrText: effectiveOcr,
          source_url: detectedUrl,
          previewUrl: fileObj.previewUrl,
          fileName: fileObj.name
        });
      }
    } else {
      const detectedUrl = extractFirstUrl(textContent);
      const effectiveCaption = textContent || (detectedUrl ? `Target URL: ${detectedUrl}` : "Manual investigation submission");
      itemsToAnalyze.push({
        id: `ev-${Date.now()}-1`,
        caption: effectiveCaption,
        ocrText: "",
        source_url: detectedUrl,
        previewUrl: null,
        fileName: null
      });
    }

    // Call Backend POST /api/analyze for each item
    updateStatusMessage("Classifying evidence against known deceptive patterns...");
    const analyzedPosts = [];

    for (let i = 0; i < itemsToAnalyze.length; i++) {
      const item = itemsToAnalyze[i];
      updateStatusMessage(`Verifying domain records and threat registries for record ${i + 1}...`);

      const resp = await fetch(`${API_BASE}/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: item.id,
          caption: item.caption,
          ocrText: item.ocrText,
          source_url: item.source_url,
          fileName: item.fileName
        })
      });

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || `Analysis request returned status ${resp.status}`);
      }

      const analyzedData = await resp.json();
      analyzedData._previewUrl = item.previewUrl;
      analyzedData._fileName = item.fileName;
      analyzedPosts.push(analyzedData);
    }

    state.analyzedPosts = analyzedPosts;

    // Call Backend POST /api/cluster
    updateStatusMessage("Correlating syndicate operations and overlapping rails...");
    let clusterResults = [];
    try {
      const clusterResp = await fetch(`${API_BASE}/cluster`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ posts: analyzedPosts })
      });

      if (clusterResp.ok) {
        const clusterData = await clusterResp.json();
        clusterResults = clusterData.clusters || [];
      }
    } catch (clusterErr) {
      console.warn("Clustering correlation note:", clusterErr);
    }

    state.clusterResults = clusterResults;

    // Transition to results board
    stopStatusAnimation();
    elements.analyzingCard.style.display = "none";
    elements.resultsWrapper.style.display = "flex";

    renderResultsBoard(analyzedPosts, clusterResults);
    showToast("Evidence analysis complete.", "info");

  } catch (err) {
    console.error("Analysis Pipeline Error:", err);
    stopStatusAnimation();
    elements.analyzingCard.style.display = "none";
    elements.scanInputCard.style.display = "flex";
    showToast(`Error: ${err.message}`, "error");
  } finally {
    state.isAnalyzing = false;
    updateAnalyzeButtonState();
  }
}

function startStatusAnimation(hasImages) {
  const messages = hasImages ? [
    "Extracting optical character transcripts from screenshots...",
    "Scanning for scam patterns and high-yield claims...",
    "Checking domain registry age and threat registries...",
    "Correlating shared UPI rails and syndicate handles..."
  ] : [
    "Scanning for scam patterns and high-yield claims...",
    "Checking domain registry age and threat registries...",
    "Correlating shared UPI rails and syndicate handles..."
  ];

  let msgIndex = 0;
  elements.analyzingStatus.textContent = messages[0];

  state.statusInterval = setInterval(() => {
    msgIndex = (msgIndex + 1) % messages.length;
    elements.analyzingStatus.textContent = messages[msgIndex];
  }, 2000);
}

function updateStatusMessage(msg) {
  if (elements.analyzingStatus) {
    elements.analyzingStatus.textContent = msg;
  }
}

function stopStatusAnimation() {
  if (state.statusInterval) {
    clearInterval(state.statusInterval);
    state.statusInterval = null;
  }
}

function resetScanboard() {
  state.uploadedFiles = [];
  state.analyzedPosts = [];
  state.clusterResults = [];
  state.activeReport = null;

  elements.textInput.value = "";
  elements.charCount.textContent = "0";
  renderThumbnails();
  updateAnalyzeButtonState();

  elements.resultsWrapper.style.display = "none";
  elements.analyzingCard.style.display = "none";
  elements.scanInputCard.style.display = "flex";
}

/* ==========================================================================
   5. RESULTS RENDERING — CASE FILE TREATMENT & ANIMATED MONOSPACE SCORE
   ========================================================================== */
function formatSentenceCaseCategory(cat = "") {
  if (!cat) return "Unclassified";
  const normalized = cat.toLowerCase().replace(/_/g, " ");
  if (normalized.includes("financial")) return "Financial investment scam";
  if (normalized.includes("job")) return "Task or employment scam";
  if (normalized.includes("pharma")) return "Unregulated pharmaceuticals";
  if (normalized.includes("replica")) return "Counterfeit luxury replica";
  if (normalized.includes("legitimate")) return "Verified standard ad";
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function getRiskMetadata(score) {
  if (score >= 70) {
    return {
      edgeClass: "risk-high-edge",
      colorClass: "risk-color-high",
      label: "High risk"
    };
  }
  if (score >= 40) {
    return {
      edgeClass: "risk-mid-edge",
      colorClass: "risk-color-mid",
      label: "Medium risk"
    };
  }
  return {
    edgeClass: "risk-low-edge",
    colorClass: "risk-color-low",
    label: "Low risk"
  };
}

// Deliberate Motion: Animate risk score counting up from 0 to finalValue (~600ms)
// Uses the exact Signal Teal (#01E8BC) as the animation accent while counting up
function animateScoreCounter(element, targetScore, finalColorClass, duration = 600) {
  element.classList.add("counting-accent");

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    element.textContent = targetScore;
    element.classList.remove("counting-accent");
    element.classList.add(finalColorClass);
    return;
  }

  const startTime = performance.now();
  const startScore = 0;

  function updateCount(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    const easedProgress = 1 - Math.pow(1 - progress, 3);
    const currentScore = Math.round(startScore + (targetScore - startScore) * easedProgress);

    element.textContent = currentScore;

    if (progress < 1) {
      requestAnimationFrame(updateCount);
    } else {
      element.textContent = targetScore;
      element.classList.remove("counting-accent");
      element.classList.add(finalColorClass);
    }
  }

  requestAnimationFrame(updateCount);
}

function renderResultsBoard(posts, clusters) {
  elements.itemCountBadge.textContent = `${posts.length} record${posts.length === 1 ? '' : 's'}`;

  elements.analyzedCardsList.innerHTML = "";
  posts.forEach((item, idx) => {
    const cardEl = createEvidenceRecordCard(item, idx);
    elements.analyzedCardsList.appendChild(cardEl);
  });

  renderClusterSection(clusters, posts);
  renderReportSection(posts, clusters);
}

function createEvidenceRecordCard(post, index) {
  const analysis = post.analysis || {};
  const score = analysis.risk_score ?? 0;
  const riskMeta = getRiskMetadata(score);
  const redFlags = analysis.red_flags || [];
  const links = analysis.extracted_links || [];
  const payments = analysis.extracted_payment_info || [];
  const safeBrowsing = post.safe_browsing;
  const previewUrl = post._previewUrl;
  const categoryLabel = formatSentenceCaseCategory(analysis.category);

  const card = document.createElement("div");
  card.className = `evidence-record ${riskMeta.edgeClass}`;

  let findingHtml = "";
  if (score < 40) {
    const safeReasoning = analysis.reasoning && analysis.reasoning.trim()
      ? analysis.reasoning
      : "No deceptive promises, fraudulent payment handles, or flagged domains detected. Text structure matches legitimate commercial outreach.";

    findingHtml = `
      <div class="annotated-finding finding-safe">
        <div class="finding-title">Annotated finding — verification notes</div>
        <div class="finding-text">${escapeHtml(safeReasoning)}</div>
      </div>
    `;
  } else {
    findingHtml = `
      <div class="annotated-finding">
        <div class="finding-title">Annotated finding — technical assessment</div>
        <div class="finding-text">${escapeHtml(analysis.reasoning || "Evidence demonstrates patterns consistent with deceptive financial solicitation.")}</div>
      </div>
    `;
  }

  const markersHtml = redFlags.length > 0
    ? `<div class="markers-group">
        <div class="markers-label">Evidence markers (${redFlags.length})</div>
        <div class="markers-list">
          ${redFlags.map((f) => `
            <span class="evidence-marker">
              <span class="marker-icon">[!]</span>
              <span>${escapeHtml(f)}</span>
            </span>
          `).join("")}
        </div>
       </div>`
    : `<div class="markers-group">
        <div class="markers-label">Evidence markers</div>
        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-slate);">None flagged</span>
       </div>`;

  const linksCodeHtml = links.length > 0
    ? links.map((l) => `<code class="tech-code">${escapeHtml(l)}</code>`).join(" ")
    : `<span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-slate);">None extracted</span>`;

  const paymentsCodeHtml = payments.length > 0
    ? payments.map((p) => `<code class="tech-code tech-code-flagged">${escapeHtml(p)}</code>`).join(" ")
    : `<span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-slate);">None extracted</span>`;

  let safeBrowsingRow = "";
  if (safeBrowsing?.checked) {
    if (safeBrowsing.flaggedUrls && safeBrowsing.flaggedUrls.length > 0) {
      safeBrowsingRow = `
        <div class="tech-row">
          <span class="tech-label">Safe browsing:</span>
          <span class="tech-code tech-code-flagged">Flagged: ${escapeHtml(safeBrowsing.flaggedUrls.join(", "))}</span>
        </div>
      `;
    } else {
      safeBrowsingRow = `
        <div class="tech-row">
          <span class="tech-label">Safe browsing:</span>
          <span class="tech-code tech-code-clean">Verified clean (Google Safe Browsing)</span>
        </div>
      `;
    }
  }

  card.innerHTML = `
    <div class="record-header">
      <div class="record-meta-col">
        <div class="record-id-row">
          <span class="record-id-tag">case://record-${index + 1}</span>
          <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-slate);">${escapeHtml(post.id)}</span>
        </div>
        <div class="record-category">${escapeHtml(categoryLabel)}</div>
      </div>

      <!-- Dominant Risk Score (Large Monospace Number) -->
      <div class="record-score-block">
        <span class="score-number" id="score-${post.id}">0</span>
        <span class="score-denom">/100</span>
        <span class="score-level-label ${riskMeta.colorClass}">${riskMeta.label}</span>
      </div>
    </div>

    <div class="record-grid ${previewUrl ? 'has-media' : ''}">
      ${previewUrl ? `
        <div class="record-media-col">
          <img src="${previewUrl}" alt="Evidence artifact preview" class="record-media-img" />
        </div>
      ` : ''}

      <div class="record-body-col">
        ${findingHtml}
        ${markersHtml}

        <div class="technical-rows">
          <div class="tech-row">
            <span class="tech-label">Extracted links:</span>
            <div>${linksCodeHtml}</div>
          </div>
          <div class="tech-row">
            <span class="tech-label">Payment handles:</span>
            <div>${paymentsCodeHtml}</div>
          </div>
          ${safeBrowsingRow}
        </div>
      </div>
    </div>
  `;

  // Trigger the deliberate 600ms count-up motion for this item's score (with Signal Teal accent)
  setTimeout(() => {
    const scoreEl = card.querySelector(`#score-${post.id}`);
    if (scoreEl) {
      animateScoreCounter(scoreEl, score, riskMeta.colorClass, 600);
    }
  }, 30);

  return card;
}

/* ==========================================================================
   6. SYNDICATE CONNECTION ANALYSIS — INTERACTIVE GRAPH / FLOWCHART
   ========================================================================== */
const MOCK_SYNDICATE_GRAPH = {
  operation: {
    id: "OP-APEX-882",
    title: "OPERATION APEX-882: COORDINATED INVESTMENT FRAUD RING",
    tag: "Correlated Syndicate Operation",
    riskScore: 94,
    convergeCount: 3,
    funnelSummary: "3 coordinated intake vectors converging on singular payment funnel & Telegram clearing hub"
  },
  posts: [
    {
      id: "post-101",
      number: "Post #101",
      platform: "Instagram Ad",
      platformBadgeClass: "ig-badge",
      riskScore: 92,
      caption: "Double your crypto in 24 hours with AI trading algorithm. Join VIP signals group now.",
      flag: "Guaranteed 100% Return",
      upi: "paytmqr28@paytm",
      tg: "@apex_returns",
      previewLabel: "100% DAILY PROFIT",
      previewSub: "AI BOT SIGNALS",
      previewBg: "linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)"
    },
    {
      id: "post-108",
      number: "Post #108",
      platform: "Telegram Broadcast",
      platformBadgeClass: "tg-badge",
      riskScore: 89,
      caption: "Proof of payout! ₹1,20,000 credited directly to member account. Deposit via UPI to start.",
      flag: "High-Yield Scam Proof",
      upi: "paytmqr28@paytm",
      tg: "t.me/apex_signals",
      previewLabel: "PAYOUT PROOF ₹1.2L",
      previewSub: "INSTANT CREDIT",
      previewBg: "linear-gradient(135deg, #064e3b 0%, #065f46 100%)"
    },
    {
      id: "post-117",
      number: "Post #117",
      platform: "Sponsored Web Funnel",
      platformBadgeClass: "web-badge",
      riskScore: 96,
      caption: "Apex Wealth Matrix: Certified automated trading algorithm. Scan QR or transfer to official UPI.",
      flag: "Phishing Landing Gateway",
      upi: "paytmqr28@paytm",
      tg: "t.me/apex_wealth_channel",
      previewLabel: "MATRIX TRADING",
      previewSub: "OFFICIAL DESK",
      previewBg: "linear-gradient(135deg, #451a03 0%, #78350f 100%)"
    }
  ],
  targets: [
    {
      id: "target-upi",
      title: "Shared UPI Settlement Rail",
      identifier: "paytmqr28@paytm",
      tag: "Primary Financial Clearing Node",
      badge: "3 / 3 sources converge",
      meta: "Beneficiary: Apex Trading Desk • Settlement Gateway: Paytm Payments Bank",
      riskScore: 98,
      riskLevel: "CRITICAL RISK",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`
    },
    {
      id: "target-tg",
      title: "Syndicate Operations Channel",
      identifier: "t.me/apex_wealth_channel",
      tag: "Divergent Victim Gateway",
      badge: "4,200 funnel members",
      meta: "Central coordinator handle @apex_admin • Automated phishing routing bot",
      riskScore: 91,
      riskLevel: "HIGH RISK",
      iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`
    }
  ]
};

// Flowchart State
state.graphMode = "demo"; // 'demo' | 'live'
state.graphZoom = 1.0;
state.graphPan = { x: 0, y: 0 };
state.activeClusters = [];
state.activePosts = [];

function renderClusterSection(clusters = [], posts = []) {
  state.activeClusters = clusters || [];
  state.activePosts = posts || [];

  const { clusterContainer } = elements;
  if (!clusterContainer) return;

  const hasRealMultiCluster = clusters.some((c) => Array.isArray(c.posts) && c.posts.length >= 2);
  // Default to demo if no real multi-cluster exists, otherwise allow live view
  if (!hasRealMultiCluster && state.graphMode === "live" && posts.length < 2) {
    state.graphMode = "demo";
  }

  // Setup Header Controls listeners
  setupFlowchartHeaderControls();

  // Render Flowchart Workspace
  renderFlowchartWorkspace();
}

function setupFlowchartHeaderControls() {
  const btnDemo = document.getElementById("btnGraphDemo");
  const btnLive = document.getElementById("btnGraphLive");
  const btnZoomIn = document.getElementById("btnGraphZoomIn");
  const btnZoomOut = document.getElementById("btnGraphZoomOut");
  const btnReset = document.getElementById("btnGraphReset");

  if (btnDemo && !btnDemo.dataset.bound) {
    btnDemo.dataset.bound = "true";
    btnDemo.addEventListener("click", () => {
      state.graphMode = "demo";
      btnDemo.classList.add("active");
      btnDemo.classList.remove("text-slate-400");
      if (btnLive) {
        btnLive.classList.remove("active");
        btnLive.classList.add("text-slate-400");
      }
      renderFlowchartWorkspace();
    });
  }

  if (btnLive && !btnLive.dataset.bound) {
    btnLive.dataset.bound = "true";
    btnLive.addEventListener("click", () => {
      state.graphMode = "live";
      btnLive.classList.add("active");
      btnLive.classList.remove("text-slate-400");
      if (btnDemo) {
        btnDemo.classList.remove("active");
        btnDemo.classList.add("text-slate-400");
      }
      renderFlowchartWorkspace();
    });
  }

  if (btnZoomIn && !btnZoomIn.dataset.bound) {
    btnZoomIn.dataset.bound = "true";
    btnZoomIn.addEventListener("click", () => {
      state.graphZoom = Math.min(1.4, state.graphZoom + 0.1);
      applyGraphTransform();
    });
  }

  if (btnZoomOut && !btnZoomOut.dataset.bound) {
    btnZoomOut.dataset.bound = "true";
    btnZoomOut.addEventListener("click", () => {
      state.graphZoom = Math.max(0.7, state.graphZoom - 0.1);
      applyGraphTransform();
    });
  }

  if (btnReset && !btnReset.dataset.bound) {
    btnReset.dataset.bound = "true";
    btnReset.addEventListener("click", () => {
      state.graphZoom = 1.0;
      state.graphPan = { x: 0, y: 0 };
      applyGraphTransform();
    });
  }

  // Update UI active states
  if (btnDemo && btnLive) {
    if (state.graphMode === "demo") {
      btnDemo.classList.add("active");
      btnDemo.classList.remove("text-slate-400");
      btnLive.classList.remove("active");
      btnLive.classList.add("text-slate-400");
    } else {
      btnLive.classList.add("active");
      btnLive.classList.remove("text-slate-400");
      btnDemo.classList.remove("active");
      btnDemo.classList.add("text-slate-400");
    }
  }
}

function renderFlowchartWorkspace() {
  const { clusterContainer } = elements;
  if (!clusterContainer) return;

  const isDemo = state.graphMode === "demo";
  const realCluster = state.activeClusters.find((c) => Array.isArray(c.posts) && c.posts.length >= 2);

  let graphData;
  if (isDemo) {
    graphData = MOCK_SYNDICATE_GRAPH;
  } else if (realCluster) {
    // Transform real cluster into graphData structure
    let idDisplay = "paytmqr28@paytm";
    if (realCluster.sharedIdentifier) {
      idDisplay = typeof realCluster.sharedIdentifier === "object"
        ? realCluster.sharedIdentifier.value
        : realCluster.sharedIdentifier;
    }

    graphData = {
      operation: {
        id: `OP-${realCluster.clusterId || "LIVE"}`,
        title: `COORDINATED SYNDICATE CAMPAIGN (#${realCluster.clusterId || "01"})`,
        tag: "Live Detected Cluster",
        riskScore: realCluster.combinedRiskScore || 90,
        convergeCount: realCluster.posts.length,
        funnelSummary: `${realCluster.posts.length} evidence items identified operating across shared infrastructure`
      },
      posts: realCluster.posts.map((p, idx) => ({
        id: `post-live-${idx}`,
        number: `Post #${idx + 101}`,
        platform: "Detected Evidence Post",
        platformBadgeClass: "ig-badge",
        riskScore: p.analysis?.risk_score ?? 88,
        caption: (p.caption || p.ocrText || "Evidence artifact content").substring(0, 100),
        flag: p.analysis?.category ? formatSentenceCaseCategory(p.analysis.category) : "Flagged Violation",
        upi: idDisplay,
        tg: "@syndicate_channel",
        previewUrl: p._previewUrl || null,
        previewLabel: `ITEM #${idx + 1}`,
        previewSub: "EVIDENCE ATTACHMENT",
        previewBg: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
      })),
      targets: [
        {
          id: "target-shared",
          title: "Convergent Financial / Channel Rail",
          identifier: idDisplay,
          tag: "Verified Overlapping Identifier",
          badge: `${realCluster.posts.length} / ${realCluster.posts.length} sources converge`,
          meta: "Identified via cross-correlation of OCR transcripts and link extraction rails",
          riskScore: realCluster.combinedRiskScore || 92,
          riskLevel: "CRITICAL RISK",
          iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`
        }
      ]
    };
  } else if (state.activePosts.length > 0) {
    // Dynamic Live Flowchart for live analyzed posts (maps real extracted UPIs & links)
    const p = state.activePosts[0];
    const pAnalysis = p.analysis || {};
    const pScore = pAnalysis.risk_score ?? 25;
    const pCategory = formatSentenceCaseCategory(pAnalysis.category || "LEGITIMATE");
    const extractedPayments = pAnalysis.extracted_payment_info || [];
    const extractedLinks = pAnalysis.extracted_links || [];

    const liveTargets = [];
    if (extractedPayments.length > 0) {
      extractedPayments.forEach((upi, idx) => {
        liveTargets.push({
          id: `target-upi-${idx}`,
          title: "Live Extracted UPI Rail",
          identifier: upi,
          tag: "Extracted Payment Rail",
          badge: "Identified in artifact",
          meta: "Real payment handle parsed directly from evidence text/OCR",
          riskScore: pScore,
          riskLevel: pScore >= 70 ? "HIGH RISK" : (pScore >= 40 ? "SUSPICIOUS" : "MONITORED"),
          iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>`
        });
      });
    }

    if (extractedLinks.length > 0) {
      const uniqueLinks = [...new Set(extractedLinks)].slice(0, 2);
      uniqueLinks.forEach((link, idx) => {
        liveTargets.push({
          id: `target-link-${idx}`,
          title: link.includes("t.me") || link.startsWith("@") ? "Live Telegram Channel" : "Live Target Domain",
          identifier: link,
          tag: link.includes("t.me") || link.startsWith("@") ? "Telegram Hub" : "Web Destination",
          badge: "Extracted channel",
          meta: "Off-platform channel discovered during forensic intake",
          riskScore: pScore,
          riskLevel: pScore >= 70 ? "HIGH RISK" : (pScore >= 40 ? "SUSPICIOUS" : "MONITORED"),
          iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`
        });
      });
    }

    if (liveTargets.length === 0) {
      liveTargets.push({
        id: "target-none",
        title: "Intake Entity Verification",
        identifier: "No external payment handles detected",
        tag: "Contained Artifact",
        badge: "Stand-alone intake",
        meta: "No off-platform payment rails or Telegram handles extracted.",
        riskScore: pScore,
        riskLevel: "VERIFIED",
        iconSvg: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
      });
    }

    graphData = {
      operation: {
        id: "OP-LIVE-INTAKE",
        title: `LIVE INTAKE INVESTIGATION: CASE #${p.id || "01"}`,
        tag: "Live Evidence Classification",
        riskScore: pScore,
        convergeCount: state.activePosts.length,
        funnelSummary: `Classified as ${pCategory} (${pScore}/100) • ${liveTargets.length} extracted infrastructure node${liveTargets.length === 1 ? '' : 's'} mapped.`
      },
      posts: state.activePosts.map((postItem, idx) => {
        const itemAnalysis = postItem.analysis || {};
        const itemScore = itemAnalysis.risk_score ?? pScore;
        const itemPayments = itemAnalysis.extracted_payment_info || [];
        const itemLinks = itemAnalysis.extracted_links || [];
        return {
          id: `post-live-${idx}`,
          number: `Post #${idx + 101}`,
          platform: postItem.fileName ? "Screenshot Intake" : "Text Intake",
          platformBadgeClass: "ig-badge",
          riskScore: itemScore,
          caption: (postItem.caption || postItem.ocrText || "Evidence artifact content").substring(0, 100),
          flag: itemAnalysis.category ? formatSentenceCaseCategory(itemAnalysis.category) : "Analyzed Post",
          upi: itemPayments[0] || (liveTargets[0]?.identifier.includes("@") ? liveTargets[0].identifier : "None detected"),
          tg: itemLinks[0] || "None detected",
          previewUrl: postItem._previewUrl || null,
          previewLabel: `CASE FILE #${idx + 1}`,
          previewSub: "INTAKE EVIDENCE",
          previewBg: "linear-gradient(135deg, #1e293b 0%, #0f172a 100%)"
        };
      }),
      targets: liveTargets
    };
  } else {
    graphData = MOCK_SYNDICATE_GRAPH;
  }

  // Build the complete flowchart markup
  clusterContainer.innerHTML = `
    <div class="syndicate-flowchart-wrapper">
      <!-- Summary Bar -->
      <div class="flowchart-summary-banner">
        <div class="flex items-center space-x-2.5">
          <span class="flex h-2.5 w-2.5 relative">
            <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
          </span>
          <span class="font-bold text-white tracking-wide" style="color: inherit;">
            ${escapeHtml(graphData.operation.title)}
          </span>
          <span class="font-mono text-[10px] px-2 py-0.5 rounded font-semibold text-rose-400 bg-rose-950/70 border border-rose-800/40">
            ${isDemo ? "SIMULATED GRAPH (DEMO)" : "LIVE CORRELATION"}
          </span>
        </div>
        <div class="flex items-center space-x-3 text-xs font-mono text-slate-400">
          <span>Connected nodes: <strong class="text-white" style="color: inherit;">${graphData.posts.length} posts</strong></span>
          <span>Target rails: <strong class="text-cyan-400">${graphData.targets.length} hub${graphData.targets.length === 1 ? '' : 's'}</strong></span>
          <span class="text-rose-400 font-bold">Threat score: ${graphData.operation.riskScore}/100</span>
        </div>
      </div>

      <!-- Resizable Graph Viewport -->
      <div class="syndicate-graph-viewport" id="graphViewport">
        <!-- Floating Guidance Tag -->
        <div class="graph-hint-badge">
          <span>Flowchart: Drag canvas to pan • Resize height from bottom-right • Hover cards to trace rails</span>
        </div>

        <!-- Canvas for Pan & Zoom -->
        <div class="syndicate-graph-canvas" id="graphCanvas">
          <!-- SVG Dynamic Curves Layer -->
          <svg class="syndicate-svg-connectors" id="graphSvg">
            <defs>
              <marker id="arrowhead" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#01E8BC" />
              </marker>
              <marker id="arrowhead-red" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#FF4757" />
              </marker>
              <marker id="arrowhead-cyan" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#06B6D4" />
              </marker>
            </defs>
          </svg>

          <!-- 3-Tier Nodes Layer -->
          <div class="syndicate-nodes-layer" id="graphNodesLayer">
            <!-- TIER 1: ROOT NODE -->
            <div class="graph-tier graph-tier-root">
              <div class="graph-node graph-node-root" data-node-id="root-op" id="nodeRootOp">
                <div class="flex items-center justify-between">
                  <div class="flex items-center space-x-3">
                    <div class="p-2.5 rounded-xl bg-cyan-950/80 border border-cyan-500/30 text-cyan-400 flex-shrink-0">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                    </div>
                    <div>
                      <div class="flex items-center space-x-2">
                        <span class="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold">${escapeHtml(graphData.operation.tag)}</span>
                        <span class="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse"></span>
                      </div>
                      <h4 class="root-title text-sm font-bold tracking-tight mt-0.5">${escapeHtml(graphData.operation.title)}</h4>
                      <p class="root-desc text-[11px] text-slate-400 mt-0.5">${escapeHtml(graphData.operation.funnelSummary)}</p>
                    </div>
                  </div>
                  <div class="pl-4 border-l border-slate-700/60 flex-shrink-0 text-right">
                    <div class="text-[10px] font-mono uppercase text-slate-400">Syndicate Risk</div>
                    <div class="text-base font-mono font-bold text-rose-400">${graphData.operation.riskScore} / 100</div>
                  </div>
                </div>
                <!-- Anchor point for downward connections -->
                <div class="anchor-point anchor-bottom"></div>
              </div>
            </div>

            <!-- TIER 2: MIDDLE ITEM CARDS -->
            <div class="graph-tier graph-tier-items">
              ${graphData.posts.map((p, idx) => `
                <div class="graph-node graph-node-post" data-node-id="${escapeHtml(p.id)}" id="node-${p.id}">
                  <!-- Top anchor point connected to root -->
                  <div class="anchor-point anchor-top"></div>

                  <!-- Header -->
                  <div class="flex items-center justify-between mb-2">
                    <div class="flex items-center space-x-1.5">
                      <span class="node-id font-mono font-bold text-xs text-cyan-400">${escapeHtml(p.number)}</span>
                      <span class="platform-badge ${escapeHtml(p.platformBadgeClass)} text-[10px] px-1.5 py-0.5 rounded font-medium">${escapeHtml(p.platform)}</span>
                    </div>
                    <span class="font-mono text-[11px] font-bold text-rose-400">${p.riskScore}/100</span>
                  </div>

                  <!-- Body with thumbnail & snippet -->
                  <div class="flex space-x-2.5 mb-2.5">
                    ${p.previewUrl ? `
                      <div class="rounded-lg overflow-hidden flex-shrink-0" style="width: 76px; height: 58px; background: #000;">
                        <img src="${escapeHtml(p.previewUrl)}" class="w-full h-full object-cover" />
                      </div>
                    ` : `
                      <div class="flex flex-col justify-center items-center text-center p-1.5 rounded-lg border border-slate-700/50 flex-shrink-0" style="width: 76px; height: 58px; background: ${p.previewBg || '#1e293b'};">
                        <div class="text-[8.5px] font-mono font-bold text-amber-300 leading-tight">${escapeHtml(p.previewLabel)}</div>
                        <div class="text-[7.5px] text-cyan-300 font-mono mt-0.5 leading-tight">${escapeHtml(p.previewSub)}</div>
                      </div>
                    `}
                    <div class="flex-1 min-w-0">
                      <p class="node-caption-text text-[11px] text-slate-300 line-clamp-2 leading-tight mb-1">
                        ${escapeHtml(p.caption)}
                      </p>
                      <div class="text-[10px] text-rose-400 font-mono">
                        ⚠ ${escapeHtml(p.flag)}
                      </div>
                    </div>
                  </div>

                  <!-- Footer with extracted handles -->
                  <div class="node-footer pt-2 border-t border-slate-700/60 flex flex-col gap-1 text-[11px] font-mono">
                    <div class="flex items-center justify-between">
                      <span class="text-slate-400 text-[10px]">UPI Rail:</span>
                      <span class="pill-val-upi text-amber-400 font-semibold">${escapeHtml(p.upi)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-slate-400 text-[10px]">Channel:</span>
                      <span class="pill-val-tg text-cyan-400 font-semibold">${escapeHtml(p.tg)}</span>
                    </div>
                  </div>

                  <!-- Bottom anchor point connected to target -->
                  <div class="anchor-point anchor-bottom"></div>
                </div>
              `).join("")}
            </div>

            <!-- TIER 3: BOTTOM TARGET HUBS -->
            <div class="graph-tier graph-tier-targets">
              ${graphData.targets.map((t, idx) => `
                <div class="graph-node graph-node-target" data-node-id="${escapeHtml(t.id)}" id="node-${t.id}">
                  <!-- Top anchor point connected from middle items -->
                  <div class="anchor-point anchor-top"></div>

                  <div class="flex items-center space-x-3">
                    <div class="p-2.5 rounded-xl ${idx === 0 ? 'bg-rose-950/80 border-rose-500/30 text-rose-400' : 'bg-cyan-950/80 border-cyan-500/30 text-cyan-400'} border flex-shrink-0">
                      ${t.iconSvg}
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center justify-between">
                        <span class="text-[10px] font-mono uppercase tracking-wider text-rose-400 font-bold">${escapeHtml(t.tag)}</span>
                        <span class="text-[10px] font-mono text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded border border-rose-800/40">${escapeHtml(t.badge)}</span>
                      </div>
                      <div class="target-id font-mono text-sm font-bold text-white tracking-wide mt-0.5 truncate">
                        ${escapeHtml(t.identifier)}
                      </div>
                      <div class="target-meta text-[11px] text-slate-400 mt-0.5 truncate">
                        ${escapeHtml(t.meta)}
                      </div>
                    </div>
                  </div>
                </div>
              `).join("")}
            </div>
          </div>
        </div>

        <!-- Corner Resize Handle -->
        <div class="graph-resize-handle">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="20" y1="8" x2="8" y2="20"/><line x1="20" y1="14" x2="14" y2="20"/>
          </svg>
        </div>
      </div>
    </div>
  `;

  // Apply initial transform and render curves
  setTimeout(() => {
    applyGraphTransform();
    setupGraphInteractivity();
  }, 40);
}

function applyGraphTransform() {
  const canvas = document.getElementById("graphCanvas");
  const zoomLevelEl = document.getElementById("graphZoomLevel");
  if (!canvas) return;

  canvas.style.transform = `translate(${state.graphPan.x}px, ${state.graphPan.y}px) scale(${state.graphZoom})`;
  if (zoomLevelEl) {
    zoomLevelEl.textContent = `${Math.round(state.graphZoom * 100)}%`;
  }
  updateGraphConnectors();
}

function updateGraphConnectors() {
  const canvas = document.getElementById("graphCanvas");
  const svg = document.getElementById("graphSvg");
  if (!canvas || !svg) return;

  const canvasRect = canvas.getBoundingClientRect();
  const currentZoom = state.graphZoom || 1.0;

  // Preserve markers/defs
  const defs = svg.querySelector("defs");
  svg.innerHTML = "";
  if (defs) svg.appendChild(defs);

  function getAnchorPos(element) {
    if (!element) return null;
    const r = element.getBoundingClientRect();
    return {
      x: (r.left + r.width / 2 - canvasRect.left) / currentZoom,
      y: (r.top + r.height / 2 - canvasRect.top) / currentZoom
    };
  }

  const rootNode = canvas.querySelector(".graph-node-root");
  const middleNodes = Array.from(canvas.querySelectorAll(".graph-node-post"));
  const targetNodes = Array.from(canvas.querySelectorAll(".graph-node-target"));

  // 1. Root -> Posts curves
  if (rootNode) {
    const rootBottom = getAnchorPos(rootNode.querySelector(".anchor-bottom"));
    if (rootBottom) {
      middleNodes.forEach((node, i) => {
        const postTop = getAnchorPos(node.querySelector(".anchor-top"));
        if (postTop) {
          drawBezierCurve(svg, rootBottom, postTop, {
            id: `curve-root-post-${i}`,
            sourceId: rootNode.dataset.nodeId,
            targetId: node.dataset.nodeId,
            color: "#01E8BC",
            markerId: "arrowhead"
          });
        }
      });
    }
  }

  // 2. Posts -> Targets curves
  middleNodes.forEach((pNode, pIdx) => {
    const postBottom = getAnchorPos(pNode.querySelector(".anchor-bottom"));
    if (postBottom) {
      targetNodes.forEach((tNode, tIdx) => {
        const targetTop = getAnchorPos(tNode.querySelector(".anchor-top"));
        if (targetTop) {
          drawBezierCurve(svg, postBottom, targetTop, {
            id: `curve-post-${pIdx}-target-${tIdx}`,
            sourceId: pNode.dataset.nodeId,
            targetId: tNode.dataset.nodeId,
            color: tIdx === 0 ? "#FF4757" : "#06B6D4",
            markerId: tIdx === 0 ? "arrowhead-red" : "arrowhead-cyan"
          });
        }
      });
    }
  });
}

function drawBezierCurve(svg, start, end, options = {}) {
  const { id = "", sourceId = "", targetId = "", color = "#01E8BC", markerId = "arrowhead" } = options;
  const x1 = start.x;
  const y1 = start.y;
  const x2 = end.x;
  const y2 = end.y;

  const dy = Math.max(Math.abs(y2 - y1) * 0.48, 35);
  const d = `M ${x1} ${y1} C ${x1} ${y1 + dy}, ${x2} ${y2 - dy}, ${x2} ${y2}`;

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", d);
  path.setAttribute("class", "graph-curve pulse-flow");
  path.setAttribute("stroke", color);
  path.setAttribute("marker-end", `url(#${markerId})`);
  path.setAttribute("data-source", sourceId);
  path.setAttribute("data-target", targetId);
  if (id) path.setAttribute("id", id);

  svg.appendChild(path);
}

function setupGraphInteractivity() {
  const viewport = document.getElementById("graphViewport");
  const canvas = document.getElementById("graphCanvas");
  if (!viewport || !canvas) return;

  // Auto-recalculate curves when viewport height is resized
  if (window.ResizeObserver && !viewport.dataset.roBound) {
    viewport.dataset.roBound = "true";
    const ro = new ResizeObserver(() => {
      requestAnimationFrame(updateGraphConnectors);
    });
    ro.observe(viewport);
  }

  // Pan / Dragging
  let isDragging = false;
  let startX = 0;
  let startY = 0;

  viewport.addEventListener("mousedown", (e) => {
    if (e.target.closest(".graph-node") || e.target.closest("button")) return;
    isDragging = true;
    startX = e.clientX - state.graphPan.x;
    startY = e.clientY - state.graphPan.y;
    canvas.classList.add("is-panning");
  });

  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    state.graphPan.x = e.clientX - startX;
    state.graphPan.y = e.clientY - startY;
    canvas.style.transform = `translate(${state.graphPan.x}px, ${state.graphPan.y}px) scale(${state.graphZoom})`;
    updateGraphConnectors();
  });

  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      canvas.classList.remove("is-panning");
    }
  });

  // Node Hover Highlighting
  canvas.querySelectorAll(".graph-node").forEach((node) => {
    node.addEventListener("mouseenter", () => {
      const nodeId = node.dataset.nodeId;
      highlightConnectedCurves(nodeId);
    });
    node.addEventListener("mouseleave", () => {
      clearCurveHighlights();
    });
  });
}

function highlightConnectedCurves(nodeId) {
  const curves = document.querySelectorAll(".graph-curve");
  curves.forEach((c) => {
    const isConn = c.dataset.source === nodeId || c.dataset.target === nodeId;
    if (isConn) {
      c.classList.add("is-highlighted");
      c.classList.remove("is-dimmed");
    } else {
      c.classList.add("is-dimmed");
      c.classList.remove("is-highlighted");
    }
  });
}

function clearCurveHighlights() {
  const curves = document.querySelectorAll(".graph-curve");
  curves.forEach((c) => {
    c.classList.remove("is-highlighted", "is-dimmed");
  });
}

/* ==========================================================================
   7. REPORT AREA (BOTTOM SECTION)
   ========================================================================== */
function renderReportSection(posts, clusters) {
  const { reportContainer } = elements;
  reportContainer.innerHTML = "";

  const highestRisk = Math.max(...posts.map((p) => p.analysis?.risk_score ?? 0), 0);
  const isAllLowRisk = highestRisk < 40;

  if (isAllLowRisk) {
    const safeBox = document.createElement("div");
    safeBox.className = "state-box state-clean-edge";
    safeBox.innerHTML = `
      <div class="state-icon-wrap">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
          <path d="m9 12 2 2 4-4"/>
        </svg>
      </div>
      <div class="state-content">
        <div class="state-heading">No action needed</div>
        <div class="state-desc">All analyzed records fall below threat thresholds. Evidence does not meet criteria for formal cybercrime escalation.</div>
      </div>
    `;
    reportContainer.appendChild(safeBox);
    return;
  }

  const topCluster = clusters.find((c) => c.posts?.length >= 2) || clusters[0] || null;

  const actionCard = document.createElement("div");
  actionCard.className = "report-action-card";
  actionCard.innerHTML = `
    <div class="report-action-text">
      <h4>Official cybercrime case file (NCRP / I4C format)</h4>
      <p>Generates a structured submission dossier formatted for cybercrime.gov.in evidence intake.</p>
    </div>
    <button class="btn btn-primary" id="generateReportBtn">
      <span>Generate report</span>
    </button>
  `;

  const dossierPlaceholder = document.createElement("div");
  dossierPlaceholder.id = "dossierPlaceholder";

  reportContainer.appendChild(actionCard);
  reportContainer.appendChild(dossierPlaceholder);

  const generateBtn = actionCard.querySelector("#generateReportBtn");
  generateBtn.addEventListener("click", async () => {
    generateBtn.disabled = true;
    generateBtn.textContent = "Compiling case dossier...";

    try {
      let reportPayload = {};
      if (topCluster) {
        reportPayload = { cluster: topCluster };
      } else {
        reportPayload = {
          post: posts[0],
          analysis: posts[0].analysis,
          safeBrowsing: posts[0].safe_browsing,
          whois: posts[0].whois
        };
      }

      const resp = await fetch(`${API_BASE}/reports`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(reportPayload)
      });

      if (!resp.ok) throw new Error("Backend dossier generation failed.");

      const reportData = await resp.json();
      state.activeReport = reportData;
      state.reportsArchive.unshift(reportData);

      // Auto-sync with ScamWeb Autofill Extension bridge & localStorage
      syncReportWithExtension(reportData);

      renderDossierView(dossierPlaceholder, reportData);
      showToast("Case dossier compiled successfully.", "info");
    } catch (err) {
      showToast(`Case file error: ${err.message}`, "error");
    } finally {
      generateBtn.disabled = false;
      generateBtn.textContent = "Re-compile case file";
    }
  });
}

function syncReportWithExtension(report) {
  try {
    const payload = {
      scamweb_payload: true,
      report_id: report.report_id,
      generated_at: report.generated_at,
      cluster_summary: report.cluster_summary,
      classification: report.classification,
      actionable_threat_infrastructure: report.actionable_threat_infrastructure,
      evidence: report.evidence
    };
    localStorage.setItem("scamweb_latest_payload", JSON.stringify(payload));
    window.postMessage({ type: "SCAMWEB_REPORT_PAYLOAD", payload }, "*");
  } catch (e) {
    // ignore
  }
}

function compileInstagramReportText(report) {
  const summary = report.cluster_summary || report.classification || {};
  const infra = report.actionable_threat_infrastructure || {};
  const payments = infra.payment_rails_to_freeze || report.evidence?.extracted_payment_info || [];
  const channels = infra.communication_channels || [];
  const domains = infra.web_domains || report.evidence?.extracted_links || [];

  return `Reason: Scam, fraud, or impersonation
Description: Fraudulent advertisement promoting guaranteed financial returns with an unregistered investment scheme. Directing victims off-platform to unverified Telegram channels and private UPI payment rails.
Suspect Account / Links: ${domains.concat(channels).join(", ") || "Ad account"}
Payment Handle: ${payments.join(", ") || "N/A"}`;
}

function compileTelegramReportText(report) {
  const summary = report.cluster_summary || report.classification || {};
  const infra = report.actionable_threat_infrastructure || {};
  const payments = infra.payment_rails_to_freeze || report.evidence?.extracted_payment_info || [];
  const channels = infra.communication_channels || [];

  return `Reason: Scam / Fake Account
Description: Channel operating an unauthorized high-risk financial fraud scheme promising unrealistic returns. Directs members to deposit funds into private UPI accounts.
Target Handle / Link: ${channels.join(", ") || "@unverified"}
Payment Rails: ${payments.join(", ") || "N/A"}`;
}

function renderDossierView(container, report) {
  const isCluster = report.report_type === "SCAM_SYNDICATE_DOSSIER";
  const summary = report.cluster_summary || report.classification || {};
  const threatInfra = report.actionable_threat_infrastructure || {};
  const payments = threatInfra.payment_rails_to_freeze || report.evidence?.extracted_payment_info || [];
  const channels = threatInfra.communication_channels || [];
  const domains = threatInfra.web_domains || report.evidence?.extracted_links || [];
  const actions = report.recommended_actions || [];

  const rawTextSummary = compilePlainTextReport(report);
  const instaSummary = compileInstagramReportText(report);
  const telegramSummary = compileTelegramReportText(report);

  container.innerHTML = `
    <div class="casefile-container">
      <div class="casefile-top">
        <div>
          <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-slate); text-transform: lowercase;">Formal submission dossier</span>
          <div class="casefile-id">${escapeHtml(report.report_id)}</div>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-secondary btn-sm" id="copyAutofillBtn" title="Copy payload for ScamWeb Autofill extension">
            <span>Copy Autofill payload</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="copyInstaBtn" title="Copy plain-text summary for Instagram report flow">
            <span>Copy for Instagram report</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="copyTelegramBtn" title="Copy plain-text summary for Telegram report flow">
            <span>Copy for Telegram report</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="copyReportBtn">
            <span id="copyBtnText">Copy full dossier</span>
          </button>
          <button class="btn btn-secondary btn-sm" id="downloadReportBtn">
            <span>Download .txt</span>
          </button>
        </div>
      </div>

      <div class="casefile-notice">
        <strong>Review before submitting — this does not send anything automatically.</strong> Verify all technical items before filing on cybercrime.gov.in.
      </div>

      <div class="casefile-body">
        <div class="casefile-sec">
          <div class="casefile-sec-title">1. Incident intake summary</div>
          <table class="casefile-table">
            <tr>
              <td class="col-label">Case reference:</td>
              <td class="col-val"><code>${escapeHtml(report.report_id)}</code></td>
            </tr>
            <tr>
              <td class="col-label">Submission portal:</td>
              <td class="col-val">cybercrime.gov.in (National Cyber Crime Reporting Portal)</td>
            </tr>
            <tr>
              <td class="col-label">Intake timestamp:</td>
              <td class="col-val">${new Date(report.generated_at).toLocaleString()}</td>
            </tr>
            <tr>
              <td class="col-label">Primary category:</td>
              <td class="col-val">${formatSentenceCaseCategory(Array.isArray(summary.primary_categories) ? summary.primary_categories.join(", ") : (summary.category || "Financial scam"))}</td>
            </tr>
            <tr>
              <td class="col-label">Assessed severity:</td>
              <td class="col-val">${summary.combined_risk_score || summary.risk_score || 95} / 100</td>
            </tr>
            ${isCluster ? `
              <tr>
                <td class="col-label">Linked campaign size:</td>
                <td class="col-val">${summary.total_linked_posts} coordinated ad records</td>
              </tr>
            ` : ''}
          </table>
        </div>

        <div class="casefile-sec">
          <div class="casefile-sec-title">2. Actionable payment rails to freeze (UPI / bank)</div>
          ${payments.length > 0 ? `
            <table class="casefile-table">
              <tr>
                <td class="col-label">Identified handles:</td>
                <td class="col-val">
                  ${payments.map((p) => `<code class="tech-code tech-code-flagged">${escapeHtml(p)}</code>`).join(" ")}
                </td>
              </tr>
              <tr>
                <td class="col-label">Statutory notice:</td>
                <td class="col-val">Immediate lien placement under Section 66D IT Act and Section 420 IPC via banking nodal officers.</td>
              </tr>
            </table>
          ` : `
            <div style="font-family: var(--font-mono); font-size: 11px; color: var(--text-slate);">No direct bank or UPI accounts extracted from text. Review ad screenshots for QR artifacts.</div>
          `}
        </div>

        <div class="casefile-sec">
          <div class="casefile-sec-title">3. Digital communication channels and domains</div>
          <table class="casefile-table">
            <tr>
              <td class="col-label">Channels:</td>
              <td class="col-val">${channels.length > 0 ? channels.map(c => `<code class="tech-code">${escapeHtml(c)}</code>`).join(" ") : "None detected"}</td>
            </tr>
            <tr>
              <td class="col-label">Phishing domains:</td>
              <td class="col-val">${domains.length > 0 ? domains.map(d => `<code class="tech-code">${escapeHtml(d)}</code>`).join(" ") : "None detected"}</td>
            </tr>
          </table>
        </div>

        <div class="casefile-sec">
          <div class="casefile-sec-title">4. Recommended investigative measures</div>
          <ol class="casefile-list">
            ${actions.length > 0 
              ? actions.map((a) => `<li>${escapeHtml(a)}</li>`).join("")
              : `
                <li>Submit identified UPI rails to National Cyber Crime Reporting Portal for banking lien placement.</li>
                <li>Issue subscriber data requests to messaging platforms under applicable statutory powers.</li>
                <li>File registrar abuse complaints on newly provisioned phishing hostnames.</li>
              `
            }
          </ol>
        </div>

        <div style="font-family: var(--font-mono); font-size: 10.5px; color: var(--text-slate); line-height: 1.4; padding: 4px 0;">
          ${escapeHtml(report.disclaimer || "")}
        </div>
      </div>
    </div>
  `;

  // 1. Copy Autofill Payload
  const copyAutofillBtn = container.querySelector("#copyAutofillBtn");
  copyAutofillBtn.addEventListener("click", () => {
    const payload = {
      scamweb_payload: true,
      report_id: report.report_id,
      generated_at: report.generated_at,
      cluster_summary: report.cluster_summary,
      classification: report.classification,
      actionable_threat_infrastructure: report.actionable_threat_infrastructure,
      evidence: report.evidence
    };
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).then(() => {
      syncReportWithExtension(report);
      showToast("Autofill payload copied! Ready for ScamWeb Extension.", "info");
    }).catch(() => {
      showToast("Unable to copy autofill payload.", "error");
    });
  });

  // 2. Copy for Instagram Report
  const copyInstaBtn = container.querySelector("#copyInstaBtn");
  copyInstaBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(instaSummary).then(() => {
      showToast("Copied text formatted for Instagram in-app report.", "info");
    }).catch(() => {
      showToast("Unable to copy to clipboard.", "error");
    });
  });

  // 3. Copy for Telegram Report
  const copyTelegramBtn = container.querySelector("#copyTelegramBtn");
  copyTelegramBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(telegramSummary).then(() => {
      showToast("Copied text formatted for Telegram in-app report.", "info");
    }).catch(() => {
      showToast("Unable to copy to clipboard.", "error");
    });
  });

  // 4. Copy Full Dossier
  const copyBtn = container.querySelector("#copyReportBtn");
  const copyText = container.querySelector("#copyBtnText");
  copyBtn.addEventListener("click", () => {
    navigator.clipboard.writeText(rawTextSummary).then(() => {
      copyText.textContent = "Copied";
      showToast("Case file copied to clipboard.", "info");
      setTimeout(() => {
        copyText.textContent = "Copy full dossier";
      }, 2000);
    }).catch(() => {
      showToast("Unable to copy to clipboard.", "error");
    });
  });

  // 5. Download .txt
  const downloadBtn = container.querySelector("#downloadReportBtn");
  downloadBtn.addEventListener("click", () => {
    const blob = new Blob([rawTextSummary], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.report_id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Downloaded case file (.txt).", "info");
  });
}

function compilePlainTextReport(report) {
  const summary = report.cluster_summary || report.classification || {};
  const infra = report.actionable_threat_infrastructure || {};
  const payments = infra.payment_rails_to_freeze || report.evidence?.extracted_payment_info || [];
  const channels = infra.communication_channels || [];
  const domains = infra.web_domains || report.evidence?.extracted_links || [];
  const actions = report.recommended_actions || [];

  return `--------------------------------------------------------------------------------
CASE DOSSIER FOR CYBERCRIME.GOV.IN SUBMISSION
--------------------------------------------------------------------------------
Case reference : ${report.report_id}
Intake time    : ${new Date(report.generated_at).toLocaleString()}
Filing format  : National Cyber Crime Reporting Portal (I4C / NCRP)

1. INCIDENT INTAKE SUMMARY
Category       : ${formatSentenceCaseCategory(Array.isArray(summary.primary_categories) ? summary.primary_categories.join(", ") : (summary.category || "Financial scam"))}
Risk score     : ${summary.combined_risk_score || summary.risk_score || 95}/100
Linked posts   : ${summary.total_linked_posts || 1}

2. TARGET PAYMENT RAILS (LIEN / FREEZE UNDER SECTION 66D IT ACT)
${payments.length > 0 ? payments.map((p, i) => `  [${i + 1}] ${p}`).join("\n") : "  None identified in text"}

3. DIGITAL INFRASTRUCTURE (TAKEDOWN & PRESERVATION)
Communication handles:
${channels.length > 0 ? channels.map(c => `  - ${c}`).join("\n") : "  - None"}

Domains / web links:
${domains.length > 0 ? domains.map(d => `  - ${d}`).join("\n") : "  - None"}

4. RECOMMENDED INVESTIGATIVE MEASURES
${actions.map((a, i) => `  ${i + 1}. ${a}`).join("\n")}

5. EVIDENCE ARTIFACT TRANSCRIPTS
${(report.evidence_chain || []).map((e) => `
Record ID : ${e.post_id}
Caption   : ${e.caption || "(empty)"}
OCR Text  : ${e.ocr_text || "(empty)"}
Findings  : ${e.reasoning || "N/A"}
Markers   : ${(e.red_flags || []).join(", ") || "None"}
`).join("\n---\n")}

--------------------------------------------------------------------------------
Notice: Review before submitting — this does not send anything automatically.
--------------------------------------------------------------------------------`;
}

/* ==========================================================================
   SECONDARY VIEWS: OPERATIONS & ARCHIVE
   ========================================================================== */
function renderOperationsView() {
  const { operationsGrid } = elements;
  operationsGrid.innerHTML = "";

  if (state.clusterResults.length === 0) {
    operationsGrid.innerHTML = `
      <div class="case-card empty-state-card">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="empty-icon">
          <line x1="1" y1="1" x2="23" y2="23"/>
          <path d="M16 16v1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h1"/>
          <path d="M10 4h4a2 2 0 0 1 2 2v4"/>
          <circle cx="18" cy="18" r="3"/>
        </svg>
        <h3>No active syndicate clusters in current session</h3>
        <p>Cross-referencing occurs automatically when multiple posts share payment handles or URLs.</p>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('nav-scanboard').click()">Return to ScanBoard</button>
      </div>
    `;
    return;
  }

  state.clusterResults.forEach((cluster) => {
    let idLabel = "Identifier";
    if (cluster.sharedIdentifier) {
      if (typeof cluster.sharedIdentifier === "object") {
        idLabel = `${cluster.sharedIdentifier.type.toLowerCase()}: ${cluster.sharedIdentifier.value}`;
      } else {
        idLabel = cluster.sharedIdentifier;
      }
    }

    const clusterScore = cluster.combinedRiskScore || 0;
    const clusterRisk = getRiskMetadata(clusterScore);

    const card = document.createElement("div");
    card.className = "case-card";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
        <div>
          <span style="font-family: var(--font-mono); font-size: 10px; color: var(--alert-red); text-transform: lowercase;">Syndicate cluster</span>
          <h4 style="font-size: 14px; margin-top: 2px;">${escapeHtml(cluster.clusterId)}</h4>
        </div>
        <span class="score-number ${clusterRisk.colorClass}" style="font-size: 22px;">${clusterScore}/100</span>
      </div>
      <p style="font-size: 12px; color: var(--text-slate); margin-bottom: 10px;">
        Correlated through infrastructure: <code class="tech-code">${escapeHtml(idLabel)}</code> across ${cluster.posts?.length || 1} evidence item(s).
      </p>
      <div style="font-family: var(--font-mono); font-size: 11px; display: flex; flex-direction: column; gap: 4px;">
        ${(cluster.posts || []).map((p, i) => `
          <div style="background: var(--bg-surface-inset); padding: 5px 8px; border: 1px solid var(--border-slate); display: flex; justify-content: space-between;">
            <span>record #${i + 1} (${p.id})</span>
            <span style="color: var(--text-slate);">${escapeHtml((p.caption || p.ocrText || "").slice(0, 45))}...</span>
          </div>
        `).join("")}
      </div>
    `;
    operationsGrid.appendChild(card);
  });
}

function renderReportsArchiveView() {
  const { reportsArchiveList } = elements;
  reportsArchiveList.innerHTML = "";

  if (state.reportsArchive.length === 0) {
    reportsArchiveList.innerHTML = `
      <div class="case-card empty-state-card">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" class="empty-icon">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="9" y1="15" x2="15" y2="15"/>
        </svg>
        <h3>No case files generated yet</h3>
        <p>Analyze flagged scam ads on the ScanBoard and generate an official report to compile an evidence file.</p>
        <button class="btn btn-secondary btn-sm" onclick="document.getElementById('nav-scanboard').click()">Return to ScanBoard</button>
      </div>
    `;
    return;
  }

  state.reportsArchive.forEach((rpt) => {
    const card = document.createElement("div");
    card.className = "case-card";
    card.style.marginBottom = "10px";
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
        <span style="font-family: var(--font-mono); font-size: 11px; color: var(--text-white);">${escapeHtml(rpt.report_id)}</span>
        <span style="font-family: var(--font-mono); font-size: 10px; color: var(--text-slate);">${new Date(rpt.generated_at).toLocaleString()}</span>
      </div>
      <p style="font-size: 12px; color: var(--text-slate); margin-bottom: 8px;">Case file formatted for cybercrime.gov.in submission.</p>
      <button class="btn btn-secondary btn-sm view-dossier-btn">View file</button>
    `;

    card.querySelector(".view-dossier-btn").addEventListener("click", () => {
      elements.navScanboard.click();
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });

    reportsArchiveList.appendChild(card);
  });
}

/* ==========================================================================
   DEMO LOADER
   ========================================================================== */
function setupDemoLoader() {
  const samplePrompts = [
    {
      text: "Earn 100% daily profit guaranteed. Invest ₹5,000 and receive ₹50,000 in 24 hours. Contact Telegram channel: https://t.me/quick_returns_forex and transfer registration via UPI to fastprofit@okaxis",
      ocrMock: "GOVERNMENT APPROVED TRADING PLATFORM. GUARANTEED 10X RETURNS IN 24 HOURS. TELEGRAM: https://t.me/quick_returns_forex"
    }
  ];

  elements.loadDemoBtn.addEventListener("click", () => {
    elements.navScanboard.click();
    const sample = samplePrompts[0];

    elements.textInput.value = sample.text;
    elements.charCount.textContent = sample.text.length;

    createMockAdScreenshot(sample.ocrMock).then((blob) => {
      const file = new File([blob], `evidence_screenshot_${Date.now()}.png`, { type: "image/png" });
      handleFilesSelected([file]);
      showToast("Loaded sample ad screenshot and text.", "info");
    });
  });
}

function createMockAdScreenshot(ocrText) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = 600;
    canvas.height = 360;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#070D19";
    ctx.fillRect(0, 0, 600, 360);

    ctx.strokeStyle = "#1F304E";
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 580, 340);

    ctx.fillStyle = "#FF4757";
    ctx.font = "bold 20px monospace";
    ctx.fillText("HIGH YIELD TRADING ADVERTISEMENT", 30, 45);

    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 22px monospace";
    ctx.fillText("GUARANTEED 10X RETURNS IN 24 HOURS", 30, 110);

    ctx.fillStyle = "#6A7B95";
    ctx.font = "15px monospace";
    ctx.fillText("Transfer UPI: fastprofit@okaxis", 30, 160);
    ctx.fillText("Telegram: https://t.me/quick_returns_forex", 30, 200);
    ctx.fillText("Reg. status: unverified platform", 30, 240);

    ctx.fillStyle = "#01E8BC";
    ctx.fillRect(30, 275, 200, 40);
    ctx.fillStyle = "#070D19";
    ctx.font = "bold 15px monospace";
    ctx.fillText("CLAIM PROFIT", 60, 300);

    canvas.toBlob((blob) => {
      resolve(blob);
    }, "image/png");
  });
}

/* ==========================================================================
   UTILITY HELPERS
   ========================================================================== */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function extractFirstUrl(text) {
  if (!text) return "";
  const match = text.match(/(https?:\/\/[^\s]+|(?:www\.)?[a-zA-Z0-9-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?)/i);
  if (!match) return "";
  let url = match[0];
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }
  return url;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    if (toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }, 3000);
}

// Start application when DOM is ready
document.addEventListener("DOMContentLoaded", init);
