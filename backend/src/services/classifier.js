// Calls Gemini's free-tier API to classify a post as scam/illegal-goods/legit.
// Swap the fetch URL + auth if you'd rather use the Claude API — the prompt
// and response contract stay the same either way.

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

export async function classifyPost({ caption = "", ocrText = "" }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set in .env");

  const userContent = `Caption: ${caption}\nOCR extracted text: ${ocrText}`;

  const resp = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
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
    throw new Error(`Gemini API error ${resp.status}: ${errText}`);
  }

  const data = await resp.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";

  let parsed;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    // Model occasionally wraps in fences despite instructions — strip and retry
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
}
