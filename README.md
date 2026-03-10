# TI-Kenya Demo

Internal demo application for complaint intake, AI triage, and manual dispatch workflows.

## Run locally

```bash
pnpm install
pnpm dev
```

Open `http://localhost:3000`.

## Environment variables

Copy `.env.example` to `.env.local` and set all required values.

Core:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GEMINI_API_KEY`
- `GEMINI_MODEL` (optional, defaults to `gemini-2.0-flash`)

R2 attachments:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`
- `R2_PUBLIC_URL` (must be a public delivery URL, not `r2.cloudflarestorage.com`)

Dispatch workflow (AutoSend):

- `AUTOSEND_API_KEY`
- `AUTOSEND_FROM_EMAIL`
- `AUTOSEND_FROM_NAME`
- `AUTOSEND_CC_EMAIL`
- `AUTOSEND_TO_EACC`
- `AUTOSEND_TO_IPOA`
- `AUTOSEND_TO_CAJ`

## Notes

- Complaint ingestion is store-first: reports are persisted even if AI triage fails.
- Manual dispatch is managed from the admin triage page with confirmation modal checks.
