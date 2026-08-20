/* eslint-disable unicorn/filename-case */
declare module '@sentry/jest-environment/jsdom' {
  import type {JestEnvironment} from '@jest/environment';

  const SentryEnvironment: typeof JestEnvironment;
  export = SentryEnvironment;
}

declare module '@sentry/jest-environment' {
  import type {JestEnvironment} from '@jest/environment';

  export function createEnvironment(options: {
    baseEnvironment: {TestEnvironment: typeof JestEnvironment};
  }): typeof JestEnvironment;
}

declare module '@sentry/jest-environment/node' {
  import type {JestEnvironment} from '@jest/environment';

  const SentryEnvironment: typeof JestEnvironment;
  export = SentryEnvironment;
}
