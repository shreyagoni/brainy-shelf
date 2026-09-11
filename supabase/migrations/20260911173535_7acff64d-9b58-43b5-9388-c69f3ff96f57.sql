CREATE POLICY "Users can upload their own PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can read their own PDFs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Users can delete their own PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pdfs' AND (storage.foldername(name))[1] = auth.uid()::text);