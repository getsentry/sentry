# Shared test utilities

`@sentry-internal/test-utils` is a private workspace package. It provides test
tooling without dependencies on Sentry applications, fixtures, or UI packages.

Add it to a consumer's `devDependencies` with `workspace:*`.

## Jest configuration

```js
import {createJestConfig} from '@sentry-internal/test-utils/jest';

export default createJestConfig({
  rootDir: import.meta.dirname,
  testMatch: ['<rootDir>/src/**/*.spec.tsx'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
});
```

The shared configuration provides jsdom, jest-dom matchers, a TypeScript/JSX
transformer, and mock clearing. Shared tooling resolves from this package, so
consumers do not need their own transformer or jsdom dependencies.

Consumer setup runs after jest-dom. Other Jest options replace the shared
defaults. Consumers own test discovery, coverage, module mappings, and providers.
Pass `{jsxImportSource: '@emotion/react'}` as the second argument for Emotion JSX.
Applications can override `testEnvironment` and `transform` for their own setup.
The jsdom environment is also available as `@sentry-internal/test-utils/environment`.

Use `sentry-test --config jest.config.mjs` in the package's test script. The runner
uses the same environment variables and watch behavior as the root test command.
The root CI command runs tests in packages with a test script, including Icons and
Scraps, on shard zero. Thus shared changes run both consumer suites.

## React helpers

Import Testing Library APIs and `userEvent` from
`@sentry-internal/test-utils/reactTestingLibrary`. This entry does not add providers
or change Testing Library configuration. Keep theme and app render wrappers in
their owning packages, and compose them with these APIs.

`@sentry-internal/test-utils/emotion` exports `getEmotionRules` for assertions on
styles that jsdom cannot return through `getComputedStyle`.

For TypeScript, reference this package's `tsconfig.json` from the consumer's test
project. Use `@sentry-internal/test-utils/jest-dom` in `compilerOptions.types` to
load the matcher types. The root typecheck builds the shared declarations before
consumer projects. Runtime exports use source files and need no build step.

Each consumer must still declare packages that its tests import directly. Import
through the shared entries when using dependencies owned by this package.
