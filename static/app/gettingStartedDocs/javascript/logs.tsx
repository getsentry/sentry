import {ExternalLink} from 'sentry/components/core/link';
import {
  StepType,
  type BasePlatformOptions,
  type ContentBlock,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const logs = <PlatformOptions extends BasePlatformOptions = BasePlatformOptions>({
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
            'Add the Sentry SDK as a dependency. The minimum version of [packageName] that supports logs is [code:9.41.0].',
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
            'Enable Sentry logs by adding [code:enableLogs: true] to your [code:Sentry.init()] configuration.',
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
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
  // Enable logs to be sent to Sentry
  enableLogs: true,
});
`,
        },
        {
          type: 'text',
          text: tct('For more detailed information, see the [link:logs documentation].', {
            link: (
              <ExternalLink
                href={`https://docs.sentry.io/platforms/javascript/guides/${docsPlatform}/logs/`}
              />
            ),
          }),
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
          text: t('Send a test log from your app to verify logs are arriving in Sentry.'),
        },
        {
          type: 'code',
          language: 'jsx',
          code: `import * as Sentry from "${packageName}";

Sentry.logger.info('User triggered test log', { log_source: 'sentry_test' })`,
        },
      ],
    },
  ],
});

export const logsFullStack = <
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
            'To add logs make sure [packageName] is up-to-date. The minimum version of [packageName] that supports logs is [code:9.41.0].',
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
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Enable Sentry logs by adding [code:enableLogs: true] to your [code:Sentry.init()] configuration.',
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
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
  // Enable logs to be sent to Sentry
  enableLogs: true,
});
`,
        },
        {
          type: 'text',
          text: tct('For more detailed information, see the [link:logs documentation].', {
            link: (
              <ExternalLink
                href={`https://docs.sentry.io/platforms/javascript/guides/${docsPlatform}/logs/`}
              />
            ),
          }),
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
            'To confirm that logs are working correctly, run your application and check the Sentry logs page for the collected logs.'
          ),
        },
        {
          type: 'code',
          language: 'jsx',
          code: `import * as Sentry from "${packageName}";

Sentry.logger.info('User triggered test log', { log_source: 'sentry_test' })`,
        },
      ],
    },
  ],
});
