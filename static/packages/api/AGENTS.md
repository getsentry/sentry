# @sentry/api

## Toolchain

Build from the repository root with the commands in the README's Development section. Run `pnpm --filter @sentry/api run build` before `typecheck` and `test:vitest`: both read the generated `src/` and `dist/` output, and the build reads the spec that `make build-api-docs build-rpc-schema` writes.

## Generated TypeScript

Build generated `.ts` modules from TypeScript compiler nodes (`ts.factory`) and write them with `writeSource` from `lib/generated-source.mjs`. Do not write TypeScript from strings, templates, or `.join()`, and do not patch it with `replaceOnce`. `pnpm --filter @sentry/api run lint:js` enforces this with the `sentry-api/no-typescript-source-strings` rule in `lint/plugin.mjs`. The generators that predate the rule are listed in `.oxlintrc.json`; take a file off that list when you move it to the printer, and do not add new ones.

## URLs

Parse URLs with `URL` (`new URL`, `URL.canParse`), never with regular expressions. `test/url-parsing.test.ts` fails on any regex that matches a scheme separator (`://`).
