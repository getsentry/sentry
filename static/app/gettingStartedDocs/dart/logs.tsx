import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

const getInstallSnippet = (params: DocsParams) => `
dependencies:
  sentry: ^${getPackageVersion(params, 'sentry.dart', '9.6.0')}`;

export const logs: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Logs for Dart are supported in SDK version [code:9.0.0] or higher. You can update your [pubspec:pubspec.yaml] to the matching version:',
            {
              code: <code />,
              pubspec: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'YAML',
              language: 'yaml',
              code: getInstallSnippet(params),
            },
          ],
        },
        {
          type: 'text',
          text: tct(
            'If you are on an older major version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/dart/migration/" />
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
            'To enable logging, you need to initialize the SDK with the [code:enableLogs] option set to [code:true].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'dart',
          code: `await Sentry.init(
  (options) {
    options.dsn = '${params.dsn.public}';
    // Enable logs to be sent to Sentry
    options.enableLogs = true;
  },
);`,
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
            'You can verify that logs are working by sending logs with the Sentry logger APIs.'
          ),
        },
        {
          type: 'code',
          language: 'dart',
          code: `Sentry.logger.fmt.info("Test log from %s", ["Sentry"])`,
        },
        {
          type: 'text',
          text: tct('For more details, check out our [link:logs documentation].', {
            link: <ExternalLink href="https://docs.sentry.io/platforms/dart/logs/" />,
          }),
        },
      ],
    },
  ],
};
