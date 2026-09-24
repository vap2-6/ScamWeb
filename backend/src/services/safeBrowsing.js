// Google Safe Browsing v4 lookup API — free tier, no billing required for
// low volume. https://developers.google.com/safe-browsing/v4/lookup-api

export async function checkUrlsAgainstSafeBrowsing(urls = []) {
  const apiKey = process.env.SAFE_BROWSING_API_KEY;
  if (!apiKey || urls.length === 0) {
    return { checked: false, flaggedUrls: [], raw: null };
  }

  const body = {
    client: { clientId: "scam-detector-hackathon", clientVersion: "0.1.0" },
    threatInfo: {
      threatTypes: [
        "MALWARE",
        "SOCIAL_ENGINEERING",
        "UNWANTED_SOFTWARE",
        "POTENTIALLY_HARMFUL_APPLICATION",
      ],
      platformTypes: ["ANY_PLATFORM"],
      threatEntryTypes: ["URL"],
      threatEntries: urls.map((url) => ({ url })),
    },
  };

  const resp = await fetch(
    `https://safebrowsing.googleapis.com/v4/threatMatches:find?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Safe Browsing API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const flaggedUrls = (data.matches ?? []).map((m) => m.threat.url);

  return { checked: true, flaggedUrls, raw: data.matches ?? [] };
}
