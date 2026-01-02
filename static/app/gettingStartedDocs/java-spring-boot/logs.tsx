import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

export const logs: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "To start using logs, make sure your application uses Sentry Java SDK version [code:8.15.1] or higher. If you're on an older major version of the SDK, follow our [link:migration guide] to upgrade.",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/java/guides/spring-boot/migration/" />
              ),
            }
          ),
        },
      ],
    },
  ],
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'To enable logging, you need to enable the feature in your Spring configuration file. You may also set [code:minimumLevel] to configure which log messages are sent to Sentry.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'application.properties',
              language: 'properties',
              code: `sentry.logs.enabled=true`,
            },
            {
              label: 'application.yml',
              language: 'yaml',
              code: `sentry:
  logs.enabled: true`,
            },
          ],
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
            'Once the feature is enabled, you can verify that logs are being sent to Sentry with the Sentry logging APIs.'
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Java',
              language: 'java',
              code: `import io.sentry.Sentry;

Sentry.logger().info("A simple log message");
Sentry.logger().error("A %s log message", "formatted");`,
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              code: `import io.sentry.Sentry

Sentry.logger().info("A simple log message")
Sentry.logger().error("A %s log message", "formatted")`,
            },
          ],
        },
      ],
    },
  ],
};
