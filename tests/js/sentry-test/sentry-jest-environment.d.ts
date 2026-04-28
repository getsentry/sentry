declare module '@sentry/jest-environment/jsdom' {
  import type {JestEnvironment} from '@jest/environment';

  const SentryEnvironment: typeof JestEnvironment;
  export = SentryEnvironment;
}
