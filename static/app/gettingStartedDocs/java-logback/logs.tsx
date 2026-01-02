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
            "To start using logs, make sure your application uses Sentry Java SDK version [code:8.15.0] or higher. If you're on an older major version of the SDK, follow our [link:migration guide] to upgrade.",
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/java/guides/logback/migration/" />
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
            'To enable logging, you need to configure the enabled logs option in the appender configuration. You may also set [code:minimumLevel] to configure which log messages are sent to Sentry.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'logback.xml',
              language: 'xml',
              code: `<appender name="sentry" class="io.sentry.logback.SentryAppender">
  <options>
    <dsn>${params.dsn.public}</dsn>
    <logs>
      <enabled>true</enabled>
    </logs>
  </options>
  <!-- Default for Log Events is INFO -->
  <minimumLevel>DEBUG</minimumLevel>
</appender>`,
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
          code: `import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class SentryLogbackExample {
  private static Logger logger = LoggerFactory.getLogger(SentryLogbackExample.class);

  public static void main(String[] args) {
    logger.info("A test log message");
  }
}`,
        },
      ],
    },
  ],
};
