# Roadmap

## v2

- **«Ваш вопрос своими словами»** — free-text question on the form. Hidden in v1
  (`QUESTION_FIELD = false` in `src/components/HoraryApp.tsx`). The plumbing is
  still there: `?q=` in the URL, `question` in the API request, the dossier line
  for the model and a retrieval facet. To turn on: flip the flag, then check the
  reading prompt uses the wording well and that `q` stays within 300 chars.
  (Requested 2026-11-11.)
