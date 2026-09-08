import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {getInstallContent, getMigrationContent, sentryImport} from './utils';

export const logs: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        ...getInstallContent(
          tct(
            'Add the Sentry SDK as a dependency. The minimum version of [packageName] that supports logs is [code:9.41.0].',
            {
              code: <code />,
              packageName: <code>@sentry/deno</code>,
            }
          )
        ),
        getMigrationContent(),
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
            'Logs are enabled by default. To also capture your [code:console] logs, add the [code:consoleLoggingIntegration] to your [code:Sentry.init()] configuration.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'typescript',
          code: `${sentryImport}

Sentry.init({
  dsn: "${params.dsn.public}",
  integrations: [
    // send console.log, console.warn, and console.error calls as logs to Sentry
    Sentry.consoleLoggingIntegration({ levels: ["log", "warn", "error"] }),
  ],
});`,
        },
        {
          type: 'text',
          text: tct('For more detailed information, see the [link:logs documentation].', {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/deno/logs/" />
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
            'Send a test log from your app, then refresh this page to verify it arrived in Sentry.'
          ),
        },
        {
          type: 'code',
          language: 'typescript',
          code: `${sentryImport}

Sentry.logger.info('User triggered test log', { action: 'test_log' })`,
        },
      ],
    },
  ],
};
