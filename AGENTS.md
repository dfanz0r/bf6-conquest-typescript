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
- Portal/native object handles are opaque. Do not rely on broad truthiness checks like `if (vehicle)` for Portal handles.
- Guard optional Portal handles with nullish checks only (`value !== undefined && value !== null`) or the local `isDefined(...)` helper.
- Native Portal calls may throw/report errors if passed `undefined` or `null`; guard before passing maybe-missing handles to native APIs.

## Portal handle behavior notes

Runtime probes in `object_behavior_test.ts` showed the following Portal/QuickJS handle behavior. Use these notes when
refactoring `conquest.ts` or adding native API calls:

- `undefined` and `null` are unsafe native API arguments. Calls such as `IsPlayerValid(undefined)`,
  `GetObjId(undefined)`, and `GetVehicleState(undefined)` emit `JsUndefinedValue` native errors even when wrapped in
  `try/catch`.
- `isDefined(...)` only protects against JavaScript `undefined`/`null`; it does not prove a Portal handle represents a
  live object.
- `mod.IsType(...)` works when called with explicit `mod.Types.*` enum values. It identified event and returned handles
  such as `Object,Player`, `Object,Vehicle`, `CapturePoint,Object`, `Object,Spawner`, `Object,Team`, and `Squad`.
  Avoid dynamic enum iteration for this check; use explicit enum values. `IsType(...)` identifies the handle type, but it
  does not prove the object is live or valid.
- Player search APIs such as `ClosestPlayerTo(...)` and `FarthestPlayerFrom(...)` can return an invalid player handle,
  not `undefined`. Invalid players observed as `IsType(player, mod.Types.Player) === true`,
  `IsPlayerValid(player) === false`, and `GetObjId(player) === -1`.
- Always guard player handles with `mod.IsPlayerValid(player)` before calling player-state APIs such as
  `GetSoldierState(...)`. Invalid player handles can still return values from some APIs (`GetTeam(...)`,
  `GetObjectPosition(...)`, stats), but `GetSoldierState(...)` emits `InvalidPlayer`.
- Missing map/spatial IDs may return typed placeholder handles rather than `undefined`. Examples: `GetCapturePoint(9999)`,
  `GetSpatialObject(9999)`, `GetVehicleSpawner(9999)`, `GetSpawner(9999)`, `GetTeam(9999)`, `GetHQ(9999)`,
  `GetMCOM(9999)`, and `GetSector(9999)` returned handles whose `GetObjId(...)` matched the requested ID and whose
  explicit `IsType(...)` checks matched the requested handle type.
- `GetObjId(...)` is useful for diagnostics and for detecting invalid player handles (`-1`), but an ID match alone does
  not prove that map/spatial data exists. `Squad` is not a `mod.Object`; passing a squad to `GetObjId(...)` produces a
  `NoMatchingOverload` native error even if TypeScript is bypassed with a cast.
- Missing capture-point placeholders appeared safe in probes: progress `0`, owner/progress/previous team `0`, and
  players-on-point count `0`.
- Missing vehicle/AI spawner placeholders did not throw when spawn was requested, but should be treated as likely no-op
  unless map data guarantees those IDs exist.
- `RandomValueInArray(...)` on an empty Portal array returns `undefined`; guard before passing the result to native APIs.

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
