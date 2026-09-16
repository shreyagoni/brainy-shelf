import { useEffect, useRef, useState } from "react";
import { Bot, Loader2, Send, Sparkles, UserRound } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";

type ChatMessage = {
  role: "user" | "model";
  text: string;
};

const STARTER_MESSAGE: ChatMessage = {
  role: "model",
  text: "Hi, I’m your study partner. Ask me to explain a topic, quiz you, or help you make a study plan.",
};

const QUICK_PROMPTS = [
  "Explain a difficult topic simply",
  "Quiz me on a subject",
  "Help me make a study plan",
];

export function StudyPartner() {
  const [messages, setMessages] = useState<ChatMessage[]>([STARTER_MESSAGE]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const endOfMessagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, sending]);

  function useQuickPrompt(prompt: string) {
    setDraft(prompt);
    setError(null);
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;

    const nextMessages = [...messages, { role: "user" as const, text }];
    setMessages(nextMessages);
    setDraft("");
    setError(null);
    setSending(true);

    try {
      const { data } = await supabase.auth.getSession();
      const accessToken = data.session?.access_token;
      if (!accessToken) {
        throw new Error("Please sign in again before using the study partner.");
      }

      const response = await fetch("/api/study-partner", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const result = (await response.json()) as { reply?: string; error?: string };
      if (!response.ok || !result.reply) {
        throw new Error(result.error ?? "The study partner could not answer right now.");
      }
      setMessages((current) => [...current, { role: "model", text: result.reply as string }]);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : "The study partner could not answer right now.");
    } finally {
      setSending(false);
    }
  }

  return (
    <section className="overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-label="Study partner">
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-accent text-accent-foreground">
            <Sparkles className="h-4 w-4" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold">Study Partner</h2>
            <p className="text-sm text-muted-foreground">A patient tutor for your next question.</p>
          </div>
        </div>
      </div>

      <div className="flex min-h-[460px] flex-col">
        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5" aria-live="polite">
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "model" && (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Bot className="h-4 w-4" />
                </span>
              )}
              <div className={`max-w-[min(85%,680px)] whitespace-pre-wrap rounded-xl px-4 py-3 text-sm leading-relaxed ${message.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"}`}>
                {message.text}
              </div>
              {message.role === "user" && (
                <span className="mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground">
                  <UserRound className="h-4 w-4" />
                </span>
              )}
            </div>
          ))}
          {sending && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </span>
              <span className="flex items-center gap-2 rounded-xl bg-muted px-4 py-3">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking…
              </span>
            </div>
          )}
          <div ref={endOfMessagesRef} />
        </div>

        <div className="border-t border-border px-5 py-4">
          <div className="mb-3 flex flex-wrap gap-2">
            {QUICK_PROMPTS.map((prompt) => (
              <Button key={prompt} type="button" variant="outline" size="sm" onClick={() => useQuickPrompt(prompt)}>
                {prompt}
              </Button>
            ))}
          </div>
          {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
          <form className="flex items-end gap-3" onSubmit={sendMessage}>
            <Textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Ask your study partner…"
              rows={2}
              disabled={sending}
              className="min-h-12 resize-none"
              aria-label="Message your study partner"
            />
            <Button type="submit" size="icon" disabled={sending || !draft.trim()} aria-label="Send message" title="Send message">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          </form>
        </div>
      </div>
    </section>
  );
}