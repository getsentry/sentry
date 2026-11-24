import {buildSdkConfig} from './buildSdkConfig';
import type {DocsParams} from './types';

const params = {} as DocsParams;

describe('buildSdkConfig', () => {
  it('re-indents parts by nesting, whatever indentation they were written with', () => {
    const config = buildSdkConfig({
      params,
      staticParts: ['dsn: "test-dsn"'],
      getIntegrations: () => [
        'Sentry.browserTracingIntegration()',
        `Sentry.replayIntegration({
                maskAllText: false,
              })`,
        `
      Sentry.feedbackIntegration({
        colorScheme: "system",

      }),`,
      ],
      getDynamicParts: () => [
        `
      // Tracing
      tracesSampleRate: 1.0`,
        `
          profileSessionSampleRate: 1.0`,
      ],
    });

    expect(`Sentry.init({\n  ${config}\n});`).toBe(`Sentry.init({
  dsn: "test-dsn",
  integrations: [
    Sentry.browserTracingIntegration(),
    Sentry.replayIntegration({
      maskAllText: false,
    }),
    Sentry.feedbackIntegration({
      colorScheme: "system",
    }),
  ],
  // Tracing
  tracesSampleRate: 1.0,
  profileSessionSampleRate: 1.0,
});`);
  });

  it('puts the separating comma before a trailing line comment', () => {
    const config = buildSdkConfig({
      params,
      staticParts: ['dsn: "https://key@example.ingest.sentry.io/1" // the DSN'],
      getIntegrations: () => [],
      getDynamicParts: () => [
        'replaysOnErrorSampleRate: 1.0 // sample sessions where errors occur.',
        'profileSessionSampleRate: 1.0',
      ],
    });

    expect(config).toBe(
      [
        'dsn: "https://key@example.ingest.sentry.io/1", // the DSN',
        '  replaysOnErrorSampleRate: 1.0, // sample sessions where errors occur.',
        '  profileSessionSampleRate: 1.0,',
      ].join('\n')
    );
  });

  it('indents continuation lines with a custom indent', () => {
    const config = buildSdkConfig({
      params,
      staticParts: ['app', 'dsn: "test-dsn"'],
      getIntegrations: () => [],
      getDynamicParts: () => [],
      indent: '    ',
    });

    expect(config).toBe('app,\n    dsn: "test-dsn",');
  });
});
