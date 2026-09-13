CREATE TABLE public.pdf_highlights (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  pdf_id UUID NOT NULL REFERENCES public.pdfs(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL,
  selected_text TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.pdf_highlights TO authenticated;
GRANT ALL ON public.pdf_highlights TO service_role;
ALTER TABLE public.pdf_highlights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view their own PDF highlights" ON public.pdf_highlights FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can create highlights for their own PDFs" ON public.pdf_highlights FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id AND EXISTS (SELECT 1 FROM public.pdfs WHERE public.pdfs.id = pdf_highlights.pdf_id AND public.pdfs.user_id = auth.uid()));
CREATE POLICY "Users can delete their own PDF highlights" ON public.pdf_highlights FOR DELETE TO authenticated USING (auth.uid() = user_id);