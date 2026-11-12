import {ExternalLink} from '@sentry/scraps/link';

import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

import {getInstallContent, getMigrationContent, getSdkInitSnippet} from './utils';

export const metrics: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        ...getInstallContent(
          tct(
            'Add the Sentry SDK as a dependency. The minimum version of [packageName] that supports metrics is [code:10.25.0].',
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
  configure: () => [],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics are automatically enabled after Sentry is initialized. You can emit metrics using the [code:Sentry.metrics] API.',
            {code: <code />}
          ),
        },
        {
          type: 'code',
          language: 'typescript',
          code: `${getSdkInitSnippet(params)}

Sentry.metrics.count('button_click', 1);
Sentry.metrics.gauge('page_load_time', 150);
Sentry.metrics.distribution('response_time', 200);`,
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/deno/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
};
