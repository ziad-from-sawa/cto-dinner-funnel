// Vercel serverless function: validates a work email and stores it in Supabase.
// Env vars required (set in Vercel project settings, never in client code):
//   SUPABASE_URL                – e.g. https://xxxx.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY   – service_role key (server-side only, bypasses RLS)

// Consumer / free mailbox providers — not "work" emails.
const FREE_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "yahoo.co.uk", "yahoo.co.in",
  "ymail.com", "rocketmail.com", "hotmail.com", "hotmail.co.uk", "outlook.com",
  "live.com", "msn.com", "icloud.com", "me.com", "mac.com", "aol.com",
  "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net", "mail.com",
  "zoho.com", "yandex.com", "yandex.ru", "hey.com", "fastmail.com",
  "tutanota.com", "tuta.com", "qq.com", "163.com", "126.com", "sina.com",
  "comcast.net", "verizon.net", "att.net", "sbcglobal.net", "btinternet.com",
]);

// Throwaway / disposable domains.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com", "guerrillamail.com", "10minutemail.com", "temp-mail.org",
  "tempmail.com", "throwaway.email", "trashmail.com", "getnada.com",
  "dispostable.com", "yopmail.com", "sharklasers.com", "maildrop.cc",
  "fakeinbox.com", "mintemail.com", "spamgourmet.com", "mohmal.com",
]);

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function classify(rawEmail) {
  const email = String(rawEmail || "").trim().toLowerCase();
  if (!email || !EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, reason: "invalid", email: null, domain: null };
  }
  const domain = email.split("@")[1];
  if (FREE_DOMAINS.has(domain) || DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: "not_work", email, domain };
  }
  return { ok: true, email, domain };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Vercel auto-parses JSON bodies; fall back to manual parse just in case.
  let body = req.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = {}; }
  }

  const { ok, reason, email, domain } = classify(body && body.email);
  if (!ok) {
    const msg = reason === "not_work"
      ? "Please use your work email — free and personal addresses aren't accepted."
      : "That doesn't look like a valid email.";
    return res.status(422).json({ error: msg, reason });
  }

  const SUPABASE_URL = process.env.SUPABASE_URL;
  const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !KEY) {
    return res.status(500).json({ error: "Server not configured." });
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/subscribers`, {
      method: "POST",
      headers: {
        apikey: KEY,
        Authorization: `Bearer ${KEY}`,
        "Content-Type": "application/json",
        Prefer: "return=minimal",
      },
      body: JSON.stringify({ email, domain }),
    });

    // 201 = inserted. 409 = duplicate (unique email) — treat as already subscribed.
    if (resp.status === 201 || resp.status === 409) {
      return res.status(200).json({ ok: true });
    }
    const detail = await resp.text();
    console.error("Supabase insert failed", resp.status, detail);
    return res.status(502).json({ error: "Could not save right now. Please try again." });
  } catch (err) {
    console.error("subscribe error", err);
    return res.status(502).json({ error: "Could not save right now. Please try again." });
  }
}
