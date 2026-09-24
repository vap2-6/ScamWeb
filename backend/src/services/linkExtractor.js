// Backup/sanity-check extraction in case the LLM misses something.
// Run this alongside classifier.js and merge results in routes/analyze.js.

const URL_REGEX = /(https?:\/\/[^\s]+)/gi;
const TELEGRAM_REGEX = /(?:t\.me\/|@)[a-zA-Z0-9_]{4,32}/gi;
const UPI_REGEX = /[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}/g; // e.g. name@okhdfcbank

export function extractLinksAndPaymentInfo(text = "") {
  const urls = [...new Set(text.match(URL_REGEX) ?? [])];
  const telegramHandles = [...new Set(text.match(TELEGRAM_REGEX) ?? [])];
  const possibleUpiIds = [...new Set(text.match(UPI_REGEX) ?? [])].filter(
    (m) => !urls.some((u) => u.includes(m)) // avoid matching emails inside URLs twice
  );

  return { urls, telegramHandles, possibleUpiIds };
}
