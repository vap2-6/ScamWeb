// Calls Gemini's API to classify a post as scam/illegal-goods/legit,
// with a robust heuristic fallback if the API key is invalid or rate-limited.

const SYSTEM_PROMPT = `You are a content safety classifier for detecting scam advertisements
and illegal product sales on social media. You will be given a post's
caption and any text extracted from its image via OCR.

Classify the content into ONE of these categories:
- SCAM_FINANCIAL: fake investment schemes, guaranteed returns, forex/crypto
  fraud, fake trading signals, Ponzi-style recruitment
- SCAM_GENERIC: fake giveaways, phishing links, fake job offers, lottery scams
- ILLEGAL_GOODS: unlicensed pharmaceuticals, weapons, counterfeit currency,
  drugs, or other contraband being advertised for sale
- COUNTERFEIT: fake branded goods, replica products sold as genuine
- LEGITIMATE: normal advertisement, no red flags

For your classification, also extract:
1. risk_score (0-100): confidence this is a genuine violation
2. red_flags: list of specific signals found
3. extracted_links: any URLs, Telegram/WhatsApp handles, or usernames mentioned
4. extracted_payment_info: any UPI ID, payment gateway link, or bank
   reference visible in the text (only if explicitly present — never infer)
5. reasoning: 1-2 sentence explanation

Constraints:
- Only flag based on what is explicitly stated in the text.
- If uncertain, prefer a lower risk_score over a false accusation.
- Do not attempt to identify the real-world identity of the account owner.
- Output strict JSON only, no other text, no markdown fences.

Output format:
{"category":"...","risk_score":0,"red_flags":[],"extracted_links":[],"extracted_payment_info":[],"reasoning":"..."}`;

function heuristicFallback(text = "") {
  const lower = text.toLowerCase();
  const red_flags = [];
  let category = "LEGITIMATE";
  let risk_score = 15;
  let reasoning = "No obvious fraudulent patterns detected.";

  // Financial scam heuristics
  if (
    lower.includes("guaranteed return") ||
    lower.includes("daily profit") ||
    lower.includes("double your money") ||
    lower.includes("100% profit") ||
    lower.includes("trading signals") ||
    lower.includes("earn money daily") ||
    lower.includes("investment plan")
  ) {
    category = "SCAM_FINANCIAL";
    risk_score = 90;
    red_flags.push("Promises unrealistic guaranteed financial returns", "High-risk unregulated investment scheme");
    reasoning = "Post advertises guaranteed financial profits and unregulated investment opportunities.";
  } else if (
    lower.includes("lottery") ||
    lower.includes("won ₹") ||
    lower.includes("claim prize") ||
    lower.includes("part-time job earn") ||
    lower.includes("free recharge")
  ) {
    category = "SCAM_GENERIC";
    risk_score = 85;
    red_flags.push("Suspicious reward or unverified job offer", "Urgent call to action");
    reasoning = "Unsolicited giveaway or dubious work-from-home scheme.";
  } else if (
    lower.includes("first copy") ||
    lower.includes("7a quality") ||
    lower.includes("master replica") ||
    lower.includes("clone iphone")
  ) {
    category = "COUNTERFEIT";
    risk_score = 80;
    red_flags.push("Counterfeit/replica merchandise offered as original", "Unofficial sales channel");
    reasoning = "Post explicitly advertises replica or counterfeit branded products.";
  } else if (
    lower.includes("fake notes") ||
    lower.includes("counterfeit currency") ||
    lower.includes("unlicensed pills")
  ) {
    category = "ILLEGAL_GOODS";
    risk_score = 98;
    red_flags.push("Sale of contraband or illicit goods", "Criminal solicitation");
    reasoning = "Direct solicitation of illegal or contraband goods.";
  }

  if (lower.includes("t.me/") || lower.includes("telegram")) {
    red_flags.push("Off-platform diversion to Telegram");
    risk_score = Math.min(100, risk_score + 10);
  }

  if (lower.includes("dm for details") || lower.includes("whatsapp")) {
    red_flags.push("Directs to private chat for transaction");
  }

  return {
    category,
    risk_score,
    red_flags,
    extracted_links: [],
    extracted_payment_info: [],
    reasoning: `${reasoning} (heuristic analysis)`,
  };
}

export async function classifyPost({ caption = "", ocrText = "" }) {
  const apiKey = process.env.GEMINI_API_KEY;
  const userContent = `Caption: ${caption}\nOCR extracted text: ${ocrText}`;

  if (!apiKey) {
    console.warn("GEMINI_API_KEY missing, using heuristic classifier.");
    return heuristicFallback(userContent);
  }

  try {
    const resp = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userContent }] }],
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!resp.ok) {
      const errText = await resp.text();
      console.warn(`Gemini API returned ${resp.status}: ${errText}. Falling back to heuristic classifier.`);
      return heuristicFallback(userContent);
    }

    const data = await resp.json();
    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

    let parsed;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      const cleaned = rawText.replace(/```json|```/g, "").trim();
      parsed = JSON.parse(cleaned);
    }

    return {
      category: parsed.category ?? "UNKNOWN",
      risk_score: parsed.risk_score ?? 0,
      red_flags: parsed.red_flags ?? [],
      extracted_links: parsed.extracted_links ?? [],
      extracted_payment_info: parsed.extracted_payment_info ?? [],
      reasoning: parsed.reasoning ?? "",
    };
  } catch (error) {
    console.warn("Gemini call failed with error:", error.message, "- falling back to heuristic analysis.");
    return heuristicFallback(userContent);
  }
}
