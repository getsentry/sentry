import {ExternalLink} from '@sentry/scraps/link';

import type {
  BasePlatformOptions,
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getInstallCodeBlock} from 'sentry/gettingStartedDocs/node/utils';
import {t, tct} from 'sentry/locale';

export const getNodeMetricsOnboarding = <
  PlatformOptions extends BasePlatformOptions = BasePlatformOptions,
>({
  docsPlatform,
  packageName,
}: {
  docsPlatform: string;
  packageName: `@sentry/${string}`;
}): OnboardingConfig<PlatformOptions> => ({
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Add the Sentry SDK as a dependency. The minimum version of [packageName] that supports metrics is [code:10.25.0].',
            {
              code: <code />,
              packageName: <code>{packageName}</code>,
            }
          ),
        },
        getInstallCodeBlock(params, {packageName}),
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
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics are automatically enabled after Sentry is initialized. You can emit metrics using the [code:Sentry.metrics] API.',
            {code: <code />}
          ),
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
          language: 'javascript',
          code: `const Sentry = require("${packageName}");

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
