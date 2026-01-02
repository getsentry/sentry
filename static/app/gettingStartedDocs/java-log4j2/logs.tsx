import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

export const logs: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            "To start using logs, make sure your application uses Sentry Java SDK version [code:8.16.0] or higher. If you're on an older major version of the SDK, follow our [link:migration guide] to upgrade.",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/java/guides/log4j2/migration/" />
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
            'To enable logging, you need to initialize the SDK with the [code:logs.enabled] option in your [code:sentry.properties] file or when you call [code:Sentry.init].',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'sentry.properties',
              language: 'properties',
              code: `logs.enabled=true`,
            },
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
        {
          type: 'text',
          text: tct(
            'You may also set [code:minimumLevel] in [code:log4j2.xml] to configure which log messages are sent to Sentry.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'log4j2.xml',
              language: 'xml',
              code: `<Sentry
  name="Sentry"
  dsn="${params.dsn.public}"
  minimumLevel="DEBUG"
/>
`,
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
          text: tct(
            'Once the handler is configured with logging enabled, any logs at or above the [code:minimumLevel] will be sent to Sentry.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          language: 'java',
          code: `import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.Logger;

public class SentryLog4jExample {
  public static void main(String[] args) {
    Logger logger = LogManager.getRootLogger();
    logger.info("A %s test log message", "formatted");
  }
}`,
        },
      ],
    },
  ],
};
