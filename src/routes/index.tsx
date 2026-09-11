import { createFileRoute, Link } from "@tanstack/react-router";
import { BookOpenText, FileText, NotebookPen, Upload } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "StudyMate — Your notes & PDFs, organized" },
      {
        name: "description",
        content:
          "StudyMate is a simple study companion: save notes and PDFs to your account and pick up where you left off, anywhere.",
      },
      { property: "og:title", content: "StudyMate — Your notes & PDFs, organized" },
      {
        property: "og:description",
        content: "Save notes and PDFs to your account and pick up where you left off.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2">
          <BookOpenText className="h-6 w-6 text-primary" />
          <span className="font-display text-xl font-semibold">StudyMate</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/auth"
            className="rounded-md px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Log in
          </Link>
          <Link
            to="/auth"
            search={{ mode: "signup" }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:opacity-90"
          >
            Sign up free
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6">
        <section className="py-20 text-center md:py-28">
          <p className="text-sm font-semibold uppercase tracking-widest text-primary">
            Your study companion
          </p>
          <h1 className="font-display mx-auto mt-4 max-w-2xl text-4xl font-bold leading-tight md:text-6xl">
            All your notes and PDFs, always with you
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
            Create an account, write notes, upload your study PDFs — and find everything
            exactly where you left it every time you log back in.
          </p>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
            <Link
              to="/auth"
              search={{ mode: "signup" }}
              className="rounded-lg bg-primary px-8 py-3 text-base font-semibold text-primary-foreground shadow-sm transition-all hover:opacity-90 hover:shadow-md"
            >
              Get started
            </Link>
            <Link
              to="/auth"
              className="rounded-lg border border-border bg-card px-8 py-3 text-base font-semibold text-foreground transition-colors hover:bg-accent"
            >
              I already have an account
            </Link>
          </div>
        </section>

        <section className="grid gap-6 pb-24 md:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <NotebookPen className="h-8 w-8 text-primary" />
            <h2 className="font-display mt-4 text-lg font-semibold">Write notes</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Jot down lecture notes, summaries, and ideas with a clean, distraction-free editor.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <Upload className="h-8 w-8 text-primary" />
            <h2 className="font-display mt-4 text-lg font-semibold">Upload PDFs</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Keep textbooks, slides, and handouts in one place and open them anytime.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <FileText className="h-8 w-8 text-primary" />
            <h2 className="font-display mt-4 text-lg font-semibold">Pick up where you left off</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Everything is saved to your account, so it is waiting for you on any device.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
