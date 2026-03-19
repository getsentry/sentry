declare module '@sentry/jest-environment/jsdom' {
  // eslint-disable-next-line import/no-extraneous-dependencies -- transitive dep of jest
  import type {JestEnvironment} from '@jest/environment';

  const SentryEnvironment: typeof JestEnvironment;
  export = SentryEnvironment;
}
