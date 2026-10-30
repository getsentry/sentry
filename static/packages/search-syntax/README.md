# Search syntax

This package holds the grammar for Sentry's search syntax (`is:unresolved
level:error count():>10`) and a structural parser for it. The Sentry frontend
builds its validating parser on the same grammar and token enums, so there is
one definition of the syntax.

```ts
import {parseSearch} from '@sentry/search-syntax/parser';
import {FilterType, Token} from '@sentry/search-syntax/tokens';

const tokens = parseSearch('level:error avg(span.duration):>1s', {
  config: {durationKeys: new Set(['span.duration'])},
});
```

There is no root export. The subpaths are:

- `@sentry/search-syntax/grammar`: the compiled [Peggy](https://peggyjs.org/)
  grammar. It builds every token through the `TokenConverter` passed in its
  options, so callers decide the token shapes.
- `@sentry/search-syntax/parser`: `parseSearch`, `parseSearchOrThrow`,
  `getKeyName`, the default config, the token types, and the structural
  `TokenConverter`.
- `@sentry/search-syntax/tokens`: the `Token`, `TermOperator`, `FilterType`
  and `BooleanOperator` enums.

The structural `TokenConverter` classifies filters and keeps exact text and
locations, but never marks tokens invalid, attaches warnings, or parses values.
Subclass it and override the `checkInvalid*` hooks, the `is*Key` predicates or
the token builders to add that.

## Shared fixtures

The frontend parser, the backend grammar in `src/sentry/api/event_search.py`,
and this package all test against [`fixtures/search-syntax`](../../../fixtures/search-syntax).
Those fixtures are the contract between the three. When you change the
grammar, update the fixtures and run all three suites:

```sh
pnpm --filter @sentry/search-syntax test
pnpm test static/app/components/searchSyntax
pytest tests/sentry/api/test_event_search.py
```

## Build and pack

```sh
pnpm --dir static/packages/search-syntax pack --pack-destination .artifacts
```

The `prepack` hook compiles the grammar and builds JavaScript and declarations
into `dist` with [Rslib](./rslib.config.mjs). Only `dist`, the package
manifest, README, and license ship. When packed, `publishConfig.exports`
replaces `exports`, so the published package points at `dist`. Inside this
repository, the app imports the source files listed in `exports` and compiles
the grammar with its own Peggy loader.
