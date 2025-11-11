import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type BasePlatformOptions,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const metrics = <
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>({
  docsPlatform,
  packageName,
  installSnippetBlock,
}: {
  docsPlatform: string;
  installSnippetBlock: ContentBlock;
  packageName: `@sentry/${string}`;
}): OnboardingConfig<PlatformOptions> => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Add the Sentry SDK as a dependency. The minimum version of [packageName] that supports metrics is [code:10.24.0].',
            {
              code: <code />,
              packageName: <code>{packageName}</code>,
            }
          ),
        },
        installSnippetBlock,
        {
          type: 'text',
          text: tct(
            'If you are on an older version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/javascript/guides/${docsPlatform}/migration/`}
                />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics are automatically enabled in your [code:Sentry.init()] configuration. You can emit metrics using the [code:Sentry.metrics] API.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `
import * as Sentry from "${packageName}";

Sentry.init({
  dsn: "${params.dsn.public}",
});

// Emit custom metrics
Sentry.metrics.count('button_click', 1);
Sentry.metrics.gauge('page_load_time', 150);
Sentry.metrics.distribution('response_time', 200);
`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/javascript/guides/${docsPlatform}/metrics/`}
                />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Send a test metric from your app to verify metrics are arriving in Sentry.'
          ),
        },
        {
          type: 'code',
          language: 'jsx',
          code: `import * as Sentry from "${packageName}";

// Emit a test metric
Sentry.metrics.count('test_counter', 1);
Sentry.metrics.gauge('test_gauge', 100);
Sentry.metrics.distribution('test_distribution', 150);
`,
        },
      ],
    },
  ],
});

export const metricsFullStack = <
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>({
  docsPlatform,
  packageName,
}: {
  docsPlatform: string;
  packageName: `@sentry/${string}`;
}): OnboardingConfig<PlatformOptions> => ({
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'To add metrics make sure [packageName] is up-to-date. The minimum version of [packageName] that supports metrics is [code:10.24.0].',
            {
              code: <code />,
              packageName: <code>{packageName}</code>,
            }
          ),
        },
        {
          type: 'code',
          language: 'bash',
          tabs: [
            {
              label: 'npm',
              value: 'npm',
              language: 'bash',
              code: `npm install ${packageName} --save`,
            },
            {
              label: 'yarn',
              value: 'yarn',
              language: 'bash',
              code: `yarn add ${packageName}`,
            },
            {
              label: 'pnpm',
              value: 'pnpm',
              language: 'bash',
              code: `pnpm add ${packageName}`,
            },
          ],
        },
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics are automatically enabled in your [code:Sentry.init()] configuration. Metrics work seamlessly in both server and client contexts.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: `
import * as Sentry from "${packageName}";

Sentry.init({
  dsn: "${params.dsn.public}",
});

// Use metrics in both server and client code
Sentry.metrics.count('user_action', 1);
Sentry.metrics.distribution('api_response_time', 150);
`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink
                  href={`https://docs.sentry.io/platforms/javascript/guides/${docsPlatform}/metrics/`}
                />
              ),
            }
          ),
        },
      ],
    },
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Send a test metric to verify metrics are working in your application.'
          ),
        },
        {
          type: 'code',
          language: 'jsx',
          code: `import * as Sentry from "${packageName}";

Sentry.metrics.count('test_metric', 1);`,
        },
      ],
    },
  ],
});
