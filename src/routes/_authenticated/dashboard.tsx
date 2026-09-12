import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  BookOpenText,
  FileText,
  Loader2,
  LogOut,
  NotebookPen,
  Plus,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
};

type PdfRow = {
  id: string;
  user_id: string;
  file_name: string;
  storage_path: string;
  file_size: number;
  created_at: string;
};

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <BookOpenText className="h-6 w-6 text-primary" />
            <span className="font-display text-xl font-semibold">StudyMate</span>
          </div>
          <Button variant="ghost" size="sm" onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Log out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Tabs defaultValue="notes">
          <TabsList>
            <TabsTrigger value="notes">
              <NotebookPen className="mr-2 h-4 w-4" />
              Notes
            </TabsTrigger>
            <TabsTrigger value="pdfs">
              <FileText className="mr-2 h-4 w-4" />
              PDFs
            </TabsTrigger>
          </TabsList>
          <TabsContent value="notes" className="mt-6">
            <NotesPanel />
          </TabsContent>
          <TabsContent value="pdfs" className="mt-6">
            <PdfsPanel />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function NotesPanel() {
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const { data: notes = [], isLoading } = useQuery({
    queryKey: ["notes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notes")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return data as Note[];
    },
  });

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  // Keep editor in sync when selection changes
  useEffect(() => {
    if (selected) {
      setTitle(selected.title);
      setContent(selected.content);
      setDirty(false);
    }
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function createNote() {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data, error } = await supabase
      .from("notes")
      .insert({ user_id: userData.user.id, title: "Untitled note", content: "" })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["notes"] });
    setSelectedId(data.id);
  }

  async function saveNote() {
    if (!selected) return;
    setSaving(true);
    const { error } = await supabase
      .from("notes")
      .update({ title: title.trim() || "Untitled note", content })
      .eq("id", selected.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setDirty(false);
    toast.success("Note saved");
    await queryClient.invalidateQueries({ queryKey: ["notes"] });
  }

  async function deleteNote(id: string) {
    const { error } = await supabase.from("notes").delete().eq("id", id);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (selectedId === id) {
      setSelectedId(null);
      setTitle("");
      setContent("");
    }
    await queryClient.invalidateQueries({ queryKey: ["notes"] });
    toast.success("Note deleted");
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="grid gap-6 md:grid-cols-[280px_1fr]">
      <div className="space-y-3">
        <Button onClick={createNote} className="w-full">
          <Plus className="mr-2 h-4 w-4" />
          New note
        </Button>
        <div className="space-y-2">
          {notes.length === 0 && (
            <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
              No notes yet. Create your first one!
            </p>
          )}
          {notes.map((note) => (
            <div
              key={note.id}
              className={`group flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors ${
                note.id === selectedId
                  ? "border-primary bg-accent"
                  : "border-border bg-card hover:bg-accent/50"
              }`}
            >
              <button
                className="min-w-0 flex-1 text-left"
                onClick={() => setSelectedId(note.id)}
              >
                <p className="truncate text-sm font-semibold">{note.title}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {new Date(note.updated_at).toLocaleDateString()}
                </p>
              </button>
              <button
                aria-label="Delete note"
                className="ml-2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                onClick={() => deleteNote(note.id)}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        {selected ? (
          <div className="space-y-4">
            <Input
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
              placeholder="Note title"
              className="font-display text-lg font-semibold"
            />
            <Textarea
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              placeholder="Start writing…"
              className="min-h-[320px] resize-y"
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {dirty ? "Unsaved changes" : "All changes saved"}
              </p>
              <Button onClick={saveNote} disabled={saving || !dirty}>
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save note
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex h-full min-h-[320px] flex-col items-center justify-center text-center">
            <NotebookPen className="h-10 w-10 text-muted-foreground/50" />
            <p className="mt-4 text-sm text-muted-foreground">
              Select a note on the left, or create a new one.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function PdfsPanel() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const { data: pdfs = [], isLoading } = useQuery({
    queryKey: ["pdfs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pdfs")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as PdfRow[];
    },
  });

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Please choose a PDF file");
      return;
    }
    setUploading(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Not signed in");
      const path = `${userData.user.id}/${crypto.randomUUID()}-${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("pdfs")
        .upload(path, file, { contentType: "application/pdf" });
      if (uploadError) throw uploadError;
      const { error: insertError } = await supabase.from("pdfs").insert({
        user_id: userData.user.id,
        file_name: file.name,
        storage_path: path,
        file_size: file.size,
      });
      if (insertError) throw insertError;
      toast.success("PDF uploaded");
      await queryClient.invalidateQueries({ queryKey: ["pdfs"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  function getPdfUrl(pdf: PdfRow) {
    const baseUrl = import.meta.env["VITE_SUPABASE_URL"];
    if (!baseUrl) return "#";
    const encodedPath = pdf.storage_path.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl.replace(/\/$/, "")}/storage/v1/object/public/pdfs/${encodedPath}`;
  }

  async function deletePdf(pdf: PdfRow) {
    const { error: storageError } = await supabase.storage
      .from("pdfs")
      .remove([pdf.storage_path]);
    if (storageError) {
      toast.error(storageError.message);
      return;
    }
    const { error } = await supabase.from("pdfs").delete().eq("id", pdf.id);
    if (error) {
      toast.error(error.message);
      return;
    }
    await queryClient.invalidateQueries({ queryKey: ["pdfs"] });
    toast.success("PDF deleted");
  }

  function formatSize(bytes: number) {
    if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <div>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleUpload}
      />
      <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
        {uploading ? (
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        ) : (
          <Upload className="mr-2 h-4 w-4" />
        )}
        Upload PDF
      </Button>

      <div className="mt-6">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : pdfs.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            No PDFs yet. Upload your first study document.
          </p>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pdfs.map((pdf) => (
              <li
                key={pdf.id}
                className="group flex items-center gap-3 rounded-xl border border-border bg-card p-4 shadow-sm"
              >
                <FileText className="h-8 w-8 shrink-0 text-primary" />
                <a
                  className="min-w-0 flex-1 text-left"
                  href={getPdfUrl(pdf)}
                  target="_blank"
                  rel="noopener noreferrer"
                  title="Open PDF"
                >
                  <p className="truncate text-sm font-semibold hover:underline">
                    {pdf.file_name}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {formatSize(pdf.file_size)} · {new Date(pdf.created_at).toLocaleDateString()}
                  </p>
                </a>
                <button
                  aria-label="Delete PDF"
                  className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                  onClick={() => deletePdf(pdf)}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
