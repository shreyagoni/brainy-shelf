import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const ExplainerInput = z.object({
  selectedText: z.string().trim().min(1).max(12000),
  pdfName: z.string().trim().min(1).max(300),
});

function isNewSupabaseApiKey(value: string) {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

function createSupabaseFetch(supabaseKey: string): typeof fetch {
  return (input, init) => {
    const headers = new Headers(
      typeof Request !== "undefined" && input instanceof Request ? input.headers : undefined,
    );
    if (init?.headers) {
      new Headers(init.headers).forEach((value, key) => headers.set(key, value));
    }
    if (isNewSupabaseApiKey(supabaseKey) && headers.get("Authorization") === `Bearer ${supabaseKey}`) {
      headers.delete("Authorization");
    }
    headers.set("apikey", supabaseKey);
    return fetch(input, { ...init, headers });
  };
}

function parseModelJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const parsed: unknown = JSON.parse(cleaned);
  return z
    .object({
      simpleExplanation: z.string(),
      realLifeExample: z.string(),
      keyPoints: z.array(z.string()).min(1).max(8),
      examAnswer: z.string(),
    })
    .parse(parsed);
}

export const Route = createFileRoute("/api/explainer")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return Response.json({ error: "Please sign in again before using the explainer." }, { status: 401 });
        }

        const token = authHeader.slice("Bearer ".length).trim();
        const supabaseUrl = process.env["SUPABASE_URL"];
        const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !supabaseKey) {
          console.error("Missing Supabase server configuration for the explainer endpoint.");
          return Response.json({ error: "The explainer is not configured yet." }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseKey, {
          global: {
            fetch: createSupabaseFetch(supabaseKey),
            headers: { Authorization: `Bearer ${token}` },
          },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: claims, error: claimsError } = await supabase.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) {
          return Response.json({ error: "Please sign in again before using the explainer." }, { status: 401 });
        }

        const inputResult = ExplainerInput.safeParse(await request.json().catch(() => null));
        if (!inputResult.success) {
          return Response.json({ error: "Select some PDF text first." }, { status: 400 });
        }

        const geminiKey = process.env["GEMINI_API_KEY"];
        if (!geminiKey) {
          console.error("GEMINI_API_KEY is not configured.");
          return Response.json({ error: "The explainer is not configured yet." }, { status: 503 });
        }

        const { selectedText, pdfName } = inputResult.data;
        const prompt = `You are a patient study tutor. Explain the selected passage from the PDF "${pdfName}" for a student who says I don't understand.

Selected passage:
"""
${selectedText}
"""

Return only valid JSON with exactly these keys:
{
  "simpleExplanation": "A plain-language explanation in 2-4 sentences.",
  "realLifeExample": "One concrete real-life example.",
  "keyPoints": ["3-5 short key points"],
  "examAnswer": "A concise exam-style answer a student could write."
}
Do not mention that you are an AI. Do not invent facts that are not supported by the passage; clearly say when context is missing.`;

        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.2,
              },
            }),
          },
        );

        if (!geminiResponse.ok) {
          console.error("Gemini explainer request failed with status", geminiResponse.status);
          return Response.json({ error: "The explainer could not answer right now. Please try again." }, { status: 502 });
        }

        const payload = (await geminiResponse.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const modelText = payload.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!modelText) {
          return Response.json({ error: "The explainer returned an empty answer. Please try again." }, { status: 502 });
        }

        try {
          return Response.json({ explanation: parseModelJson(modelText) });
        } catch (error) {
          console.error("Gemini returned an unexpected explainer shape", error);
          return Response.json({ error: "The explainer returned an unexpected answer. Please try again." }, { status: 502 });
        }
      },
    },
  },
});