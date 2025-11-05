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
            "To start using logs, make sure your application uses Sentry Java SDK version [code:8.12.0] or higher. If you're on an older major version of the SDK, follow our [link:migration guide] to upgrade.",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/java/migration/" />
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
            'To enable logging, you need to initialize the SDK with the [code:logs.enabled] option set to [code:true].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Java',
              language: 'java',
              code: `import io.sentry.Sentry;

Sentry.init(options -> {
  options.setDsn("${params.dsn.public}");
  options.getLogs().setEnabled(true);
});`,
            },
            {
              label: 'Kotlin',
              language: 'kotlin',
              code: `import io.sentry.Sentry

Sentry.init { options ->
  options.dsn = "${params.dsn.public}"
  options.logs.enabled = true
}`,
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
          text: t('Send a test log from your app to verify logs are arriving in Sentry.'),
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
