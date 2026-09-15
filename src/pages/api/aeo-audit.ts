export const prerender = false; // SSR only — not static

import type { APIRoute } from "astro";

/* ─────────────────────────────────────────────
   Helper: probe a single ChatGPT-style prompt
   and detect if the brand is mentioned.
   Uses OpenAI API if OPENAI_API_KEY is set,
   otherwise falls back to a deterministic mock.
───────────────────────────────────────────── */

interface AuditPayload {
  brand:    string;
  url?:     string;
  category: string;
  name:     string;
  phone:    string;
  contact?: string;
  keywords: string;
  lang?:    string;
  ref?:     string;
}

interface AuditResult {
  sov:         number;        // 0–100 share of voice
  competitors: string[];      // brand names AI mentioned instead
  probed:      number;        // how many prompts were sent
  mentioned:   number;        // how many times brand appeared
}

const PROBE_PROMPTS = (brand: string, category: string) => [
  `ธุรกิจ ${category} ที่ดีที่สุดในไทยคืออะไร?`,
  `แนะนำบริษัท ${category} ที่น่าเชื่อถือให้หน่อย`,
  `ถ้าต้องการ ${category} ในประเทศไทย ควรเลือกเจ้าไหน?`,
  `${category} ในไทยเจ้าไหนดีที่สุด?`,
  `ใครให้บริการ ${category} ได้ดีในไทย?`,
];

async function probeWithOpenAI(
  payload: AuditPayload,
  apiKey: string
): Promise<AuditResult> {
  const prompts = PROBE_PROMPTS(payload.brand, payload.category);
  let mentioned = 0;
  const competitorSet = new Set<string>();

  for (const userMsg of prompts) {
    try {
      const resp = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          max_tokens: 300,
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content:
                "คุณเป็นผู้ช่วย AI ที่ตอบคำถามเกี่ยวกับธุรกิจในประเทศไทย ตอบสั้นกระชับ แนะนำแบรนด์ที่รู้จัก",
            },
            { role: "user", content: userMsg },
          ],
        }),
      });

      if (!resp.ok) continue;
      const json = await resp.json();
      const answer: string = json.choices?.[0]?.message?.content ?? "";

      // Check brand mention (case-insensitive)
      if (answer.toLowerCase().includes(payload.brand.toLowerCase())) {
        mentioned++;
      } else {
        // Extract competitor names: words with capital letters that appear as proper nouns
        const brandMatches = answer.match(/[A-ZÀ-ÿ][a-zà-ÿA-ZÀ-ÿ]+(?:\s[A-ZÀ-ÿ][a-zà-ÿ]+)*/g) ?? [];
        brandMatches
          .filter(
            (b) =>
              b !== payload.brand &&
              b.length > 2 &&
              !/^(ใน|ที่|และ|หรือ|เป็น|ของ|จาก|แบบ|สำหรับ|ให้|ได้|ดี|มาก|น่า|ควร|คือ)$/.test(b)
          )
          .slice(0, 2)
          .forEach((b) => competitorSet.add(b));
      }
    } catch {
      /* skip failed prompts */
    }
  }

  const sov = Math.round((mentioned / prompts.length) * 100);
  return {
    sov,
    competitors: [...competitorSet].slice(0, 4),
    probed: prompts.length,
    mentioned,
  };
}

/* Deterministic mock when no API key is configured */
function mockAudit(payload: AuditPayload): AuditResult {
  // Simple hash to make results consistent per brand name
  let hash = 0;
  for (let i = 0; i < payload.brand.length; i++) {
    hash = (hash * 31 + payload.brand.charCodeAt(i)) & 0xffff;
  }
  const sov = hash % 100 < 40 ? 0 : hash % 30; // most brands score 0 initially
  const mockCompetitors = ["TechCare Thailand", "IT Pro Service", "NetSupport Co"].slice(
    0,
    sov === 0 ? 3 : 1
  );
  return { sov, competitors: sov === 0 ? mockCompetitors : [], probed: 5, mentioned: 0 };
}

/* ─── Astro API Route ─── */
export const POST: APIRoute = async ({ request }) => {
  let payload: AuditPayload;

  try {
    payload = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!payload.brand || !payload.category) {
    return new Response(
      JSON.stringify({ error: "brand and category are required" }),
      { status: 422, headers: { "Content-Type": "application/json" } }
    );
  }

  // Use real OpenAI probe if key is available, else mock
  const apiKey = import.meta.env.OPENAI_API_KEY ?? "";
  let result: AuditResult;

  if (apiKey) {
    result = await probeWithOpenAI(payload, apiKey);
  } else {
    result = mockAudit(payload);
  }

  // TODO: log lead (name, phone, brand) to your CRM / Google Sheet here
  // e.g. await saveLead({ ...payload, ...result });

  return new Response(JSON.stringify(result), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
};
