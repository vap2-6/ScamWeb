// Domain-age and registration lookup service.
// Supports:
// 1. WhoisXML API (if WHOISXML_API_KEY is provided)
// 2. Free ICANN RDAP protocol fallback (no API key required)
//
// Gated behind process.env.ENABLE_WHOIS === "true".

// Common legitimate domains / platforms to exclude from domain age alerts
const EXCLUDED_PLATFORMS = new Set([
  "instagram.com",
  "facebook.com",
  "fb.me",
  "meta.com",
  "t.me",
  "telegram.org",
  "telegram.me",
  "whatsapp.com",
  "wa.me",
  "google.com",
  "goo.gl",
  "youtube.com",
  "youtu.be",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "reddit.com",
  "picsum.photos",
]);

/**
 * Extracts and cleans hostname/domain from a URL or raw domain string
 */
export function extractDomain(urlOrDomain = "") {
  if (!urlOrDomain || typeof urlOrDomain !== "string") return null;

  let cleaned = urlOrDomain.trim().toLowerCase();
  
  // Strip protocol
  cleaned = cleaned.replace(/^https?:\/\//i, "");
  // Strip trailing path/query/fragment
  cleaned = cleaned.split("/")[0].split("?")[0].split("#")[0];
  // Strip port
  cleaned = cleaned.split(":")[0];
  // Strip leading www.
  cleaned = cleaned.replace(/^www\./i, "");

  if (!cleaned || !cleaned.includes(".")) return null;
  return cleaned;
}

/**
 * Checks domain age via RDAP (free, official protocol)
 */
async function lookupViaRdap(domain) {
  const resp = await fetch(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/rdap+json, application/json",
    },
  });

  if (!resp.ok) {
    throw new Error(`RDAP returned HTTP ${resp.status}`);
  }

  const data = await resp.json();
  
  // Registration date is typically found in events array
  const events = data.events || [];
  const regEvent = events.find(
    (e) =>
      e.eventAction === "registration" ||
      e.eventAction === "registered" ||
      e.eventAction === "created"
  );

  const createdDate = regEvent?.eventDate || null;
  const registrar =
    data.entities?.find((ent) => ent.roles?.includes("registrar"))?.vcardArray?.[1]?.find(
      (v) => v[0] === "fn"
    )?.[3] || data.port43 || "Unknown";

  return { createdDate, registrar };
}

/**
 * Checks domain age via WhoisXML API
 */
async function lookupViaWhoisXml(domain, apiKey) {
  const resp = await fetch(
    `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${apiKey}&domainName=${encodeURIComponent(
      domain
    )}&outputFormat=JSON`
  );

  if (!resp.ok) {
    throw new Error(`WhoisXML returned HTTP ${resp.status}`);
  }

  const data = await resp.json();
  const createdDate = data?.WhoisRecord?.createdDate || null;
  const registrar = data?.WhoisRecord?.registrarName || "Unknown";
  return { createdDate, registrar };
}

/**
 * Checks domain registration age and risk indicators for a single domain.
 */
export async function checkDomainAge(domainOrUrl) {
  if (process.env.ENABLE_WHOIS !== "true") {
    return { checked: false, ageInDays: null, note: "WHOIS disabled (set ENABLE_WHOIS=true)" };
  }

  const domain = extractDomain(domainOrUrl);
  if (!domain) {
    return { checked: false, domain: domainOrUrl, ageInDays: null, note: "Invalid domain format" };
  }

  if (EXCLUDED_PLATFORMS.has(domain)) {
    return {
      checked: false,
      domain,
      ageInDays: null,
      note: "Excluded known social platform / CDN domain",
    };
  }

  let createdDate = null;
  let registrar = "Unknown";
  let lookupProvider = "None";

  // 1. Try WhoisXML API if key is present
  const apiKey = process.env.WHOISXML_API_KEY;
  if (apiKey) {
    try {
      const xmlRes = await lookupViaWhoisXml(domain, apiKey);
      createdDate = xmlRes.createdDate;
      registrar = xmlRes.registrar;
      lookupProvider = "WhoisXML API";
    } catch (err) {
      console.warn(`WhoisXML lookup failed for ${domain}:`, err.message, "- falling back to RDAP");
    }
  }

  // 2. Fallback to free ICANN RDAP standard lookup
  if (!createdDate) {
    try {
      const rdapRes = await lookupViaRdap(domain);
      createdDate = rdapRes.createdDate;
      registrar = rdapRes.registrar;
      lookupProvider = "ICANN RDAP";
    } catch (err) {
      return {
        checked: false,
        domain,
        ageInDays: null,
        note: `Lookup failed: ${err.message}`,
      };
    }
  }

  if (!createdDate) {
    return {
      checked: false,
      domain,
      ageInDays: null,
      note: "No registration date found in WHOIS/RDAP records",
    };
  }

  const createdTime = new Date(createdDate).getTime();
  const ageInDays = Math.max(0, Math.floor((Date.now() - createdTime) / (1000 * 60 * 60 * 24)));

  // Risk categorization based on domain registration age:
  // Scam domains are overwhelmingly registered < 30-90 days before campaign launch
  const isNewlyRegistered = ageInDays < 90;
  const isVeryYoung = ageInDays < 30;

  let riskLevel = "ESTABLISHED";
  if (isVeryYoung) riskLevel = "CRITICAL";
  else if (isNewlyRegistered) riskLevel = "HIGH";
  else if (ageInDays < 365) riskLevel = "MEDIUM";

  return {
    checked: true,
    domain,
    ageInDays,
    createdDate,
    registrar,
    provider: lookupProvider,
    isNewlyRegistered,
    isVeryYoung,
    riskLevel,
    note: isNewlyRegistered
      ? `High-risk domain registered only ${ageInDays} day(s) ago`
      : `Domain established (${ageInDays} days old)`,
  };
}

/**
 * Checks all domains extracted from a list of URLs or link strings.
 */
export async function checkDomainsAge(urlsOrDomains = []) {
  if (process.env.ENABLE_WHOIS !== "true") {
    return { checked: false, domains: [], newlyRegisteredCount: 0, note: "WHOIS disabled" };
  }

  // Extract unique domains
  const domainSet = new Set();
  for (const item of urlsOrDomains) {
    const domain = extractDomain(item);
    if (domain && !EXCLUDED_PLATFORMS.has(domain)) {
      domainSet.add(domain);
    }
  }

  const uniqueDomains = Array.from(domainSet);
  if (uniqueDomains.length === 0) {
    return {
      checked: true,
      domains: [],
      newlyRegisteredCount: 0,
      note: "No external non-platform domains to verify",
    };
  }

  const results = await Promise.all(
    uniqueDomains.map(async (domain) => {
      try {
        return await checkDomainAge(domain);
      } catch (err) {
        return { checked: false, domain, note: err.message };
      }
    })
  );

  const newlyRegisteredCount = results.filter((r) => r.checked && r.isNewlyRegistered).length;
  const hasSuspiciousDomain = newlyRegisteredCount > 0;

  return {
    checked: true,
    domains: results,
    newlyRegisteredCount,
    hasSuspiciousDomain,
    summary: hasSuspiciousDomain
      ? `Flagged ${newlyRegisteredCount} newly registered domain(s) (<90 days old)`
      : `Verified ${results.length} external domain(s); all appear established`,
  };
}
