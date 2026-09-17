import { useEffect, useMemo, useRef, useState } from "react";
import { BookOpenCheck, Check, Highlighter, Lightbulb, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { PDFDocumentProxy, RenderTask } from "pdfjs-dist";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

type PdfRecord = {
  id: string;
  file_name: string;
  storage_path: string;
};

type Highlight = {
  id: string;
  page_number: number;
  selected_text: string;
};

type PdfDocument = PDFDocumentProxy;

type PdfJsModule = typeof import("pdfjs-dist");
type TextLayerOptions = ConstructorParameters<PdfJsModule["TextLayer"]>[0];

type Selection = {
  pageNumber: number;
  text: string;
};

type Explanation = {
  simpleExplanation: string;
  realLifeExample: string;
  keyPoints: string[];
  examAnswer: string;
};

function getPublicPdfUrl(pdf: PdfRecord) {
  const baseUrl = import.meta.env["VITE_SUPABASE_URL"];
  if (!baseUrl) return "";
  const encodedPath = pdf.storage_path.split("/").map(encodeURIComponent).join("/");
  return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/pdfs/${encodedPath}`;
}

function applySavedHighlights(container: HTMLElement, highlights: Highlight[]) {
  const spans = Array.from(container.querySelectorAll<HTMLElement>("span"));
  for (const span of spans) span.classList.remove("pdf-saved-highlight");

  const pageHighlights = highlights.filter((highlight) => highlight.selected_text.trim());
  for (const highlight of pageHighlights) {
    const target = highlight.selected_text.replace(/\s+/g, " ").trim().toLowerCase();
    let documentText = "";
    const spanRanges: Array<{ span: HTMLElement; start: number; end: number }> = [];
    for (const span of spans) {
      const text = (span.textContent ?? "").replace(/\s+/g, " ");
      const start = documentText.length;
      documentText += text;
      spanRanges.push({ span, start, end: documentText.length });
    }
    const matchStart = documentText.toLowerCase().indexOf(target);
    if (matchStart < 0) continue;
    const matchEnd = matchStart + target.length;
    for (const range of spanRanges) {
      if (range.end > matchStart && range.start < matchEnd) {
        range.span.classList.add("pdf-saved-highlight");
      }
    }
  }
}

function PdfPageView({
  document,
  pageNumber,
  highlights,
  pdfJs,
  onSelection,
}: {
  document: PdfDocument;
  pageNumber: number;
  highlights: Highlight[];
  pdfJs: PdfJsModule;
  onSelection: (selection: Selection | null) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const textLayerRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let renderTask: RenderTask | undefined;
    let textLayer: InstanceType<PdfJsModule["TextLayer"]> | undefined;

    async function renderPage() {
      const canvas = canvasRef.current;
      const textLayerContainer = textLayerRef.current;
      if (!canvas || !textLayerContainer) return;

      setLoading(true);
      setError(false);
      try {
        const page = await document.getPage(pageNumber);
        if (cancelled) return;
        const viewport = page.getViewport({ scale: 1.35 });
        const context = canvas.getContext("2d");
        if (!context) throw new Error("Canvas is unavailable");

        const outputScale = window.devicePixelRatio || 1;
        canvas.width = Math.ceil(viewport.width * outputScale);
        canvas.height = Math.ceil(viewport.height * outputScale);
        canvas.style.width = `${viewport.width}px`;
        canvas.style.height = `${viewport.height}px`;
        textLayerContainer.style.width = `${viewport.width}px`;
        textLayerContainer.style.height = `${viewport.height}px`;
        context.setTransform(outputScale, 0, 0, outputScale, 0, 0);

        renderTask = page.render({ canvasContext: context, viewport });
        const textContent = await page.getTextContent();
        textLayer = new pdfJs.TextLayer({
          textContentSource: textContent as TextLayerOptions["textContentSource"],
          container: textLayerContainer,
          viewport,
        });
        await Promise.all([renderTask.promise, textLayer.render()]);
        if (cancelled) return;
        applySavedHighlights(textLayerContainer, highlights);
        setLoading(false);
      } catch (renderError) {
        if (!cancelled) {
          console.error("Could not render PDF page", renderError);
          setError(true);
          setLoading(false);
        }
      }
    }

    void renderPage();
    return () => {
      cancelled = true;
      renderTask?.cancel();
      textLayer?.cancel();
    };
  }, [document, highlights, pageNumber, pdfJs]);

  function captureSelection() {
    const selection = window.getSelection();
    const text = selection?.toString().replace(/\s+/g, " ").trim() ?? "";
    const layer = textLayerRef.current;
    if (!selection || !layer || !text || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!layer.contains(range.commonAncestorContainer)) return;
    onSelection({ pageNumber, text });
  }

  return (
    <div className="relative mx-auto mb-8 w-fit overflow-hidden border border-border bg-card shadow-sm">
      <canvas ref={canvasRef} className="block" aria-label={`Page ${pageNumber}`} />
      <div
        ref={textLayerRef}
        className="studymate-pdf-text-layer absolute left-0 top-0"
        onMouseUp={captureSelection}
      />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-card/80">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center p-6 text-center text-sm text-destructive">
          This page could not be rendered.
        </div>
      )}
      <span className="absolute bottom-2 right-2 rounded bg-card/90 px-2 py-1 text-xs text-muted-foreground shadow-sm">
        {pageNumber}
      </span>
    </div>
  );
}

export function PdfReader({ pdf, onClose }: { pdf: PdfRecord; onClose: () => void }) {
  const [pdfJs, setPdfJs] = useState<PdfJsModule | null>(null);
  const [document, setDocument] = useState<PdfDocument | null>(null);
  const documentRef = useRef<PdfDocument | null>(null);
  const [loadingDocument, setLoadingDocument] = useState(true);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selectedHighlightId, setSelectedHighlightId] = useState<string | null>(null);
  const [savingHighlight, setSavingHighlight] = useState(false);
  const [explaining, setExplaining] = useState(false);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [explanationError, setExplanationError] = useState<string | null>(null);
  const [highlights, setHighlights] = useState<Highlight[]>([]);

  const pdfUrl = useMemo(() => getPublicPdfUrl(pdf), [pdf]);

  useEffect(() => {
    let cancelled = false;
    let loadedDocument: PdfDocument | null = null;

    async function loadPdf() {
      setLoadingDocument(true);
      setDocument(null);
      void documentRef.current?.destroy();
      documentRef.current = null;
      try {
        const module = await import("pdfjs-dist");
        module.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.mjs",
          import.meta.url,
        ).toString();
        const loadingTask = module.getDocument({ url: pdfUrl });
        loadedDocument = await loadingTask.promise;
        if (!cancelled) {
          setPdfJs(module);
          setDocument(loadedDocument);
          documentRef.current = loadedDocument;
          setLoadingDocument(false);
        } else {
          await loadedDocument.destroy();
        }
      } catch (error) {
        console.error("Could not load PDF", error);
        if (!cancelled) {
          setLoadingDocument(false);
          toast.error("This PDF could not be opened in the reader.");
        }
      }
    }
    void loadPdf();
    return () => {
      cancelled = true;
      if (loadedDocument) void loadedDocument.destroy();
      documentRef.current = null;
    };
  }, [pdfUrl]);

  useEffect(() => {
    let cancelled = false;
    async function loadHighlights() {
      const { data, error } = await supabase
        .from("pdf_highlights")
        .select("id, page_number, selected_text")
        .eq("pdf_id", pdf.id)
        .order("created_at", { ascending: true });
      if (cancelled) return;
      if (error) {
        toast.error(error.message);
        return;
      }
      setHighlights(data as Highlight[]);
    }
    void loadHighlights();
    return () => {
      cancelled = true;
    };
  }, [pdf.id]);

  async function saveHighlight() {
    if (!selection) return;
    setSavingHighlight(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      toast.error("Please sign in again to save highlights.");
      setSavingHighlight(false);
      return;
    }
    const { data, error } = await supabase
      .from("pdf_highlights")
      .insert({
        user_id: userData.user.id,
        pdf_id: pdf.id,
        page_number: selection.pageNumber,
        selected_text: selection.text,
      })
      .select("id, page_number, selected_text")
      .single();
    setSavingHighlight(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setHighlights((current) => [...current, data as Highlight]);
    setSelectedHighlightId(data.id);
    toast.success("Highlight saved");
  }

  async function deleteHighlight(id: string) {
    const { error } = await supabase.from("pdf_highlights").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    setHighlights((current) => current.filter((highlight) => highlight.id !== id));
    if (selectedHighlightId === id) {
      setSelectedHighlightId(null);
      setSelection(null);
    }
  }

  async function explainSelection() {
    if (!selection) return;
    setExplaining(true);
    setExplanation(null);
    setExplanationError(null);
    const { data } = await supabase.auth.getSession();
    const accessToken = data.session?.access_token;
    if (!accessToken) {
      setExplanationError("Please sign in again before using the explainer.");
      setExplaining(false);
      return;
    }
    try {
      const response = await fetch("/api/explainer", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ selectedText: selection.text, pdfName: pdf.file_name }),
      });
      const result = (await response.json()) as { explanation?: Explanation; error?: string };
      if (!response.ok || !result.explanation) {
        setExplanationError(result.error ?? "The explainer could not answer right now.");
      } else {
        setExplanation(result.explanation);
      }
    } catch {
      setExplanationError("The explainer could not answer right now. Please try again.");
    } finally {
      setExplaining(false);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-card px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 shrink-0 text-primary" />
            <h2 className="truncate font-display text-lg font-semibold">{pdf.file_name}</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Select text on any page to save a highlight or ask for a simpler explanation.
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" asChild>
            <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
              Open original PDF
            </a>
          </Button>
          <Button variant="outline" onClick={onClose}>Close reader</Button>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_320px]">
        <ScrollArea className="min-h-0 bg-muted/30 p-4 sm:p-8">
          {loadingDocument && (
            <div className="flex min-h-96 items-center justify-center">
              <Loader2 className="h-7 w-7 animate-spin text-primary" />
            </div>
          )}
          {!loadingDocument && !document && (
            <div className="flex min-h-96 items-center justify-center text-sm text-destructive">
              This PDF could not be loaded.
            </div>
          )}
          {document && pdfJs && (
            <div>
              {Array.from({ length: document.numPages }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <PdfPageView
                    key={pageNumber}
                    document={document}
                    pageNumber={pageNumber}
                    highlights={highlights.filter((highlight) => highlight.page_number === pageNumber)}
                    pdfJs={pdfJs}
                    onSelection={setSelection}
                  />
                );
              })}
            </div>
          )}
        </ScrollArea>

        <aside className="flex min-h-0 flex-col border-t border-border bg-card lg:border-l lg:border-t-0">
          <div className="border-b border-border p-5">
            <div className="flex items-center gap-2">
              <Highlighter className="h-4 w-4 text-primary" />
              <h3 className="font-display font-semibold">Highlights</h3>
              <span className="text-sm text-muted-foreground">{highlights.length}</span>
            </div>
            {selection ? (
              <div className="mt-4 rounded-lg border border-primary/30 bg-accent/50 p-3">
                <p className="line-clamp-4 text-sm leading-relaxed">“{selection.text}”</p>
                <p className="mt-2 text-xs text-muted-foreground">Page {selection.pageNumber}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" onClick={saveHighlight} disabled={savingHighlight}>
                    {savingHighlight && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                    Save highlight
                  </Button>
                  <Button size="sm" variant="outline" onClick={explainSelection} disabled={explaining}>
                    {explaining ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : <Lightbulb className="mr-2 h-3.5 w-3.5" />}
                    Explain this
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">Select a passage in the pages to get started.</p>
            )}
          </div>

          <ScrollArea className="min-h-0 flex-1 p-5">
            <div className="space-y-3">
              {highlights.length === 0 && <p className="text-sm text-muted-foreground">Saved highlights will appear here.</p>}
              {highlights.map((highlight) => (
                <div
                  key={highlight.id}
                  className={`group rounded-lg border p-3 ${selectedHighlightId === highlight.id ? "border-primary bg-accent/50" : "border-border"}`}
                >
                  <button
                    className="w-full text-left"
                    onClick={() => {
                      setSelectedHighlightId(highlight.id);
                      setSelection({ pageNumber: highlight.page_number, text: highlight.selected_text });
                    }}
                  >
                    <p className="line-clamp-4 text-sm leading-relaxed">{highlight.selected_text}</p>
                    <p className="mt-2 text-xs text-muted-foreground">Page {highlight.page_number}</p>
                  </button>
                  <div className="mt-2 flex items-center justify-between">
                    {selectedHighlightId === highlight.id ? (
                      <span className="flex items-center gap-1 text-xs text-primary"><Check className="h-3 w-3" /> Selected</span>
                    ) : <span />}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                      aria-label="Delete highlight"
                      onClick={() => void deleteHighlight(highlight.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
            {(explanation || explanationError || explaining) && (
              <div className="mt-6 border-t border-border pt-5">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-4 w-4 text-primary" />
                  <h3 className="font-display font-semibold">I Don’t Understand</h3>
                </div>
                {explaining && <p className="mt-3 text-sm text-muted-foreground">Building a simpler explanation…</p>}
                {explanationError && <p className="mt-3 text-sm text-destructive">{explanationError}</p>}
                {explanation && (
                  <div className="mt-3 space-y-4 text-sm">
                    <section><h4 className="font-semibold">Simple explanation</h4><p className="mt-1 leading-relaxed text-muted-foreground">{explanation.simpleExplanation}</p></section>
                    <section><h4 className="font-semibold">Real-life example</h4><p className="mt-1 leading-relaxed text-muted-foreground">{explanation.realLifeExample}</p></section>
                    <section><h4 className="font-semibold">Key points</h4><ul className="mt-1 list-disc space-y-1 pl-5 text-muted-foreground">{explanation.keyPoints.map((point) => <li key={point}>{point}</li>)}</ul></section>
                    <section><h4 className="font-semibold">Exam-style answer</h4><p className="mt-1 leading-relaxed text-muted-foreground">{explanation.examAnswer}</p></section>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </aside>
      </div>
    </div>
  );
}