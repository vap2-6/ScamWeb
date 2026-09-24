// [OPTIONAL / STRETCH] Domain-age lookup.
// Only wire this in if Day 1 core pipeline is done early.
//
// Free option: https://www.whoisxmlapi.com/ (free tier ~1000 lookups/mo)
// or shell out to the `whois` CLI if available on your dev machines.
//
// Gate every call site behind process.env.ENABLE_WHOIS === "true" so the
// core demo never depends on this being wired up correctly.

export async function checkDomainAge(domain) {
  if (process.env.ENABLE_WHOIS !== "true") {
    return { checked: false, ageInDays: null, note: "WHOIS disabled" };
  }

  const apiKey = process.env.WHOISXML_API_KEY;
  if (!apiKey) {
    return { checked: false, ageInDays: null, note: "WHOISXML_API_KEY not set" };
  }

  const resp = await fetch(
    `https://www.whoisxmlapi.com/whoisserver/WhoisService?apiKey=${apiKey}&domainName=${encodeURIComponent(
      domain
    )}&outputFormat=JSON`
  );
  if (!resp.ok) return { checked: false, ageInDays: null, note: `HTTP ${resp.status}` };

  const data = await resp.json();
  const createdDate = data?.WhoisRecord?.createdDate;
  if (!createdDate) return { checked: false, ageInDays: null, note: "no createdDate returned" };

  const ageInDays = Math.floor(
    (Date.now() - new Date(createdDate).getTime()) / (1000 * 60 * 60 * 24)
  );

  return { checked: true, ageInDays, createdDate };
}
