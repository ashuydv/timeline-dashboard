# Timeline Dashboard

React + TypeScript + MUI dashboard for machine timeline/production data, with token-based auth
against a real backend.

## Running

```bash
npm install
cp .env.example .env.local   # set VITE_API_BASE_URL if different from the default
npm run dev
```

Open the printed local URL (typically `http://localhost:5173`) and sign in with:

- **username:** `analytics_user`
- **password:** `dashboard123`

Data exists for **22–25 June 2026** — pick a date in that range or shifts will come back empty.

## Environment

| Variable              | Purpose                                   | Default (`.env.example`)                                    |
| ---------------------- | ------------------------------------------ | ------------------------------------------------------------ |
| `VITE_API_BASE_URL`   | Backend base URL (no `/api` prefix)        | `https://fractaldmsdev.centralindia.cloudapp.azure.com`      |

## Scripts

- `npm run dev` — start the Vite dev server
- `npm run build` — typecheck (`tsc -b`) and produce a production build in `dist/`
- `npm run preview` — serve the production build locally
- `npm run lint` — run oxlint

See [NOTES.md](./NOTES.md) for design decisions: token storage trade-offs, chart performance
approach, UTC↔IST time handling, and what was cut.
