# AGENTS.md

Guidance for coding agents working in this repository.

## Project overview

- This is a TypeScript Battlefield Portal / `mod` script project.
- Main source: `conquest.ts`.
- Local helper library: `modlib/index.ts`.
- Portal/type declarations: `types/mod/index.d.ts`.
- Refactor notes, if needed for context: `REFACTOR_PLAN.md`.

## Critical workflow rules

- Use the harness `read` tool to inspect files before editing.
- Use the harness `edit` tool for targeted changes to existing files.
- Use `write` only for new files or an intentional full-file rewrite.
- Do **not** edit source with `sed`, `awk`, Perl, Python scripts, or shell redirection.
- Do **not** use git commands that discard work (`git checkout`, `git reset`, `git restore`, `git revert`) unless the user explicitly asks.
- Before changing behavior, check the surrounding code and call sites. Avoid broad search-and-replace in `conquest.ts`.
- After TypeScript changes, run the most relevant TypeScript check available in this checkout and report the result. If it cannot be run, say why.

## Build / verification

Preferred check:

```bash
npx -p typescript tsc --noEmit
```

Notes:

- `tsconfig.json` is configured for strict TypeScript and includes all `*.ts` plus `types/**/*.d.ts`.
- This checkout currently has a `packages.json` file rather than the standard `package.json`, so `npm run build` may not work unless the environment has been adjusted.
- Docs-only edits, including this file, do not require a build.

## Code style

- Follow `.editorconfig`: UTF-8, LF, final newline, 4-space indentation for TypeScript/JSON, max line length 128.
- Prefer small, local changes over large rewrites.
- Keep names and organization consistent with nearby code.
- Preserve strict typing. Avoid `any` unless the surrounding Portal API wrapper already uses it.
- Prefer explicit null checks for nullable Portal object references.

## `conquest.ts` refactor safety

- Move or rename one function/method at a time.
- For method extraction/migration, use this order:
  1. read the exact source and call sites,
  2. add or update the method,
  3. update call sites,
  4. remove the old free function only after verifying references,
  5. run a TypeScript check if available.
- Beware class method declarations: do not prefix declarations inside a class with an instance name.
- When using `edit` with multiple edits in one file, remember each `oldText` is matched against the original file, not incrementally.

## Reporting

- Summarize changed files and verification performed.
- If verification fails due to missing tooling/dependencies, include the exact command and failure reason.
