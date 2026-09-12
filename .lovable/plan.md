# Direct PDF opening fix

## Changes
- Remove the JavaScript PDF-opening helper from the dashboard.
- Render each PDF title as a normal link to its Supabase public object URL with `target="_blank"`.
- Keep upload, listing, and deletion behavior unchanged.

## Verification
- Confirm no iframe, embedded viewer, blob URL, proxy, or click-based PDF opener remains.
- Check the latest app build status.
