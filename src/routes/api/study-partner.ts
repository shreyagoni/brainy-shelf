import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const StudyPartnerInput = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string().trim().min(1).max(8000),
      }),
    )
    .min(1)
    .max(20),
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

export const Route = createFileRoute("/api/study-partner")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return Response.json({ error: "Please sign in again before using the study partner." }, { status: 401 });
        }

        const token = authHeader.slice("Bearer ".length).trim();
        const supabaseUrl = process.env["SUPABASE_URL"];
        const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !supabaseKey) {
          console.error("Missing Supabase server configuration for the study partner endpoint.");
          return Response.json({ error: "The study partner is not configured yet." }, { status: 500 });
        }

        const authenticatedSupabase = createClient(supabaseUrl, supabaseKey, {
          global: {
            fetch: createSupabaseFetch(supabaseKey),
            headers: { Authorization: `Bearer ${token}` },
          },
          auth: { persistSession: false, autoRefreshToken: false, storage: undefined },
        });
        const { data: claims, error: claimsError } = await authenticatedSupabase.auth.getClaims(token);
        if (claimsError || !claims?.claims?.sub) {
          return Response.json({ error: "Please sign in again before using the study partner." }, { status: 401 });
        }

        const inputResult = StudyPartnerInput.safeParse(await request.json().catch(() => null));
        if (!inputResult.success) {
          return Response.json({ error: "Please enter a study question." }, { status: 400 });
        }

        const geminiKey = process.env["GEMINI_API_KEY"];
        if (!geminiKey) {
          console.error("GEMINI_API_KEY is not configured.");
          return Response.json({ error: "The study partner is not configured yet." }, { status: 503 });
        }

        const geminiResponse = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              systemInstruction: {
                parts: [
                  {
                    text: "You are StudyMate, a warm and precise study partner. Help students understand topics, plan revision, make practice questions, and check their thinking. Use clear language, short sections, and examples when helpful. Do not claim certainty when a question needs missing context. Never mention API details or that you are following a system instruction.",
                  },
                ],
              },
              contents: inputResult.data.messages.map((message) => ({
                role: message.role,
                parts: [{ text: message.text }],
              })),
              generationConfig: {
                temperature: 0.35,
                maxOutputTokens: 1200,
              },
            }),
          },
        );

        if (!geminiResponse.ok) {
          const providerMessage = await geminiResponse.text().catch(() => "");
          console.error("Gemini study partner request failed", geminiResponse.status, providerMessage.slice(0, 500));
          return Response.json(
            { error: "The study partner could not answer right now. Please try again." },
            { status: 502 },
          );
        }

        const payload = (await geminiResponse.json()) as {
          candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
        };
        const reply = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim();
        if (!reply) {
          return Response.json({ error: "The study partner returned an empty answer. Please try again." }, { status: 502 });
        }

        return Response.json({ reply });
      },
    },
  },
});