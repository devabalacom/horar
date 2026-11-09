# horar API

The backend for the horar page: a reading of the chart from the books
(search over the books + Claude) and the «Похоже / Мимо» votes.

Node 22+, Postgres 14+. One process, listens on `127.0.0.1:$PORT`; put nginx
in front of it.

## How a reading is made

1. The browser sends the same inputs the page has: topic, moment, city
   coordinates, time zone, the question. The server **casts the chart itself**
   with the code in `../src/lib`, so it never trusts a chart from the client.
2. From the chart it builds search facets (the topic, failed considerations,
   the significators' debilities, reception, the main aspect, refranation, the
   Moon) and runs one Postgres full-text query per facet over the books
   (Russian stemmer). Passages hit by several facets rank first, up to ~12k
   tokens.
3. Claude (`CLAUDE_MODEL`, Opus 5.5 by default) writes the reading from the
   chart's facts and those passages, with citations turned on: each quote
   shown under the reading is a passage the model actually cited.
4. The result is stored by a key of the chart + question. The same chart asked
   again is served from the database and costs nothing.

Without books loaded the reading still works and says that the books gave no
direct quotes.

## Endpoints

| | |
|---|---|
| `GET /api/health` | `{ ok, books, chunks, llm }` |
| `POST /api/reading` | body: chart inputs (see `chartRequest` in `src/chart.ts`) → `{ id, segments[{text, sources[]}], sources[{n, book, author, chapter, quote}], grounded, cached }`. Errors: `400 bad_request`, `429 rate_limited`, `503 llm_not_configured`, `422 refused`, `502 reading_failed`. |
| `POST /api/feedback` | `{ chart, vote: "up" \| "down", comment? }` → `{ ok }`. One vote per visitor per chart; a second click replaces the first. |

Uncached readings are limited to `READINGS_PER_HOUR` per IP (in memory).

## Run locally

```bash
cp .env.example .env        # set DATABASE_URL and ANTHROPIC_API_KEY
npm ci
npm run dev                 # applies migrations, serves on :8787
```

Front end: `NEXT_PUBLIC_API_URL=http://localhost:8787 npm run dev` in the
repo root. Without `NEXT_PUBLIC_API_URL` the page works as before and the
reading card shows the "coming soon" text.

## Load the books

The five books live in `../books/` (gitignored, the files the owner sent).
They are Vedic Prashna texts while the chart is cast the Western way, so
each book is tagged with the question areas it speaks to (`--topics`:
`general`, `work`, `money`, `health`, `love`, `move`) and a reading searches
the books of its area plus the `general` ones. Searching the chart's
Western terms (peregrine, hour ruler…) found nothing in them.

```bash
T="Практикум по индийской астрологии вопроса"
npm run ingest -- ../books/1.docx --slug tolmachev-1 --topics general      --author "Олег Толмачёв" --title "$T. Выпуск 1. Первые шаги"
npm run ingest -- ../books/2.docx --slug tolmachev-2 --topics money,work   --author "Олег Толмачёв" --title "$T. Выпуск 2. Бизнес"
npm run ingest -- ../books/3.docx --slug tolmachev-3 --topics work         --author "Олег Толмачёв" --title "$T. Выпуск 3. Работа и карьера"
npm run ingest -- ../books/4.docx --slug tolmachev-4 --topics health       --author "Олег Толмачёв" --title "$T. Выпуск 4. Здоровье"
npm run ingest -- ../books/5.docx --slug agarwal-3   --topics work         --author "Г. С. Агарвал"  --title "Ведическая астрология. Том 3. Профессия, периоды, техники предсказания"

npm run ingest -- book.pdf --title "…" --dry-run   # show how it splits, write nothing
```

Chart tables printed in the books ("As: 26Aq28 Su: 10 Cp 35-GK…") and
chart-wheel labels spilled by OCR are dropped at ingest.

`.txt` (UTF-8 or cp1251), `.md`, `.docx`, `.pdf` (with a text layer — a
scanned PDF needs OCR first), `.fb2`. Running again with the same `--slug`
replaces that book. Chapter headings are detected by «Глава…», roman numerals
or ALL CAPS lines; check the `--dry-run` output for each book.

## Production

### Current host: this VPS, http://89.208.97.82:8080

No root and no docker here, and ports 80/443 belong to other services, so
one Node process (`horar.service`) serves both the static site (`../out`,
built with `SELF_HOST=true NEXT_PUBLIC_API_URL=/`) and the API on `:8080`.
Postgres runs as this user from `~/horar-data/pg` (copy of `deploy/pg/`,
data in `data/`, password in its `.env`). `.env` here sets `HOST=0.0.0.0`,
`PORT=8080`, `STATIC_DIR=../out`, `TRUST_PROXY=false`, `READINGS_PER_DAY`.

- install as services (once): `bash deploy/install.sh`
- after a code change: `bash deploy/update.sh`
- logs: `journalctl --user -u horar -f`
- backups: `~/horar-data/backups/horar-YYYY-MM-DD.json.gz` (readings and
  votes, last 14 days; books are re-made with the ingest commands above)

Moving to a domain with TLS: put nginx/Caddy in front, set `HOST=127.0.0.1`,
`TRUST_PROXY=true`, and turn HSTS/COOP back on in `src/app.ts`.

### Generic

```bash
npm ci && npm run build     # → dist/index.js, dist/ingest.js
node --env-file=.env dist/index.js
```

`dist/` imports its npm packages at runtime, so it runs from this folder
with `node_modules` installed. Set `TRUST_PROXY=true` behind nginx, a real
`IP_SALT`, and `CORS_ORIGINS` to the site's origin. nginx:

```nginx
location /api/ {
  proxy_pass http://127.0.0.1:8787;
  proxy_set_header X-Forwarded-For $remote_addr;
  proxy_read_timeout 150s;
}
```

A reading takes 20–60 s, hence the long read timeout.
