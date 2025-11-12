import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export const logs: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Logs for Apple platforms are supported in Sentry Cocoa SDK version [code:8.55.0] and above. If you are using an older major version of the SDK, follow our [link:migration guide] to upgrade.',
            {
              code: <code />,
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/migration/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'SPM',
              language: 'swift',
              code: `.package(url: "https://github.com/getsentry/sentry-cocoa", from: "${getPackageVersion(
                params,
                'sentry.cocoa',
                '8.55.0'
              )}"),`,
            },
            {
              label: 'CocoaPods',
              language: 'ruby',
              code: `pod update`,
            },
            {
              label: 'Carthage',
              language: 'swift',
              code: `github "getsentry/sentry-cocoa" "${getPackageVersion(
                params,
                'sentry.cocoa',
                '8.55.0'
              )}"`,
            },
          ],
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
            'To enable logging, you need to initialize the SDK with the [code:enableLogs] option set to true.',
            {
              code: <code />,
            }
          ),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'Swift',
              language: 'swift',
              code: `import Sentry

SentrySDK.start { options in
    options.dsn = "${params.dsn.public}"
    // Enable logs to be sent to Sentry
    options.experimental.enableLogs = true
}`,
            },
            {
              label: 'Objective-C',
              language: 'objc',
              code: `@import Sentry;

[SentrySDK startWithConfigureOptions:^(SentryOptions *options) {
    options.dsn = @"${params.dsn.public}";
    // Enable logs to be sent to Sentry
    options.experimental.enableLogs = YES;
}];`,
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
              label: 'Swift',
              language: 'swift',
              code: `import Sentry

let logger = SentrySDK.logger

logger.info("Sending a test info log")

logger.warn("Sending a test warning log", attributes: [
    "log_type": "test",
])`,
            },
            {
              label: 'Objective-C',
              language: 'objc',
              code: `@import Sentry;

SentryLogger *logger = SentrySDK.logger;

[logger info:@"Sending a test info log"];
[logger warn:@"Sending a test warning log" attributes:@{@"log_type": @"test"}];`,
            },
          ],
        },
      ],
    },
  ],
};
