import {ExternalLink} from 'sentry/components/core/link';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';
import {getPackageVersion} from 'sentry/utils/gettingStartedDocs/getPackageVersion';

export const metrics: OnboardingConfig = {
  install: params => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics for Apple platforms are supported in Sentry Cocoa SDK version [code:9.2.0] and above. If you are using an older version of the SDK, follow our [link:migration guide] to upgrade.',
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
                '9.2.0'
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
                '9.2.0'
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
          text: t(
            'Metrics are enabled by default once the SDK is initialized. No additional configuration is required.'
          ),
        },
        {
          type: 'code',
          language: 'swift',
          code: `import Sentry

SentrySDK.start { options in
    options.dsn = "${params.dsn.public}"
}`,
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
            'Send test metrics from your app to verify metrics are arriving in Sentry.'
          ),
        },
        {
          type: 'code',
          language: 'swift',
          code: `import Sentry

// Counter metric
SentrySDK.metrics.count(key: "button_click", value: 1)

// Gauge metric
SentrySDK.metrics.gauge(key: "queue_depth", value: 42.0)

// Distribution metric with unit
SentrySDK.metrics.distribution(key: "response_time", value: 187.5, unit: .millisecond)

// Counter with unit and attributes
SentrySDK.metrics.count(
    key: "network.request.count",
    value: 1,
    unit: .generic("request"),
    attributes: ["endpoint": "/api/users", "method": "POST"]
)`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/apple/guides/ios/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
};
