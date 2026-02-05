import {ExternalLink} from '@sentry/scraps/link';

import {
  type ContentBlock,
  type DocsParams,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {tct} from 'sentry/locale';

export const metricsVerify = (params: DocsParams): ContentBlock => ({
  type: 'conditional',
  condition: params.isMetricsSelected,
  content: [
    {
      type: 'text',
      text: tct(
        'Send test metrics from your app to verify metrics are arriving in Sentry.',
        {code: <code />}
      ),
    },
    {
      type: 'code',
      language: 'dotnet',
      code: `using Sentry;

SentrySdk.Experimental.Metrics.EmitCounter("button_click", 5,
    [new KeyValuePair<string, object>("browser", "Firefox"), new KeyValuePair<string, object>("app_version", "1.0.0")]);
SentrySdk.Experimental.Metrics.EmitDistribution("page_load", 15.0, SentryUnits.Duration.Millisecond,
    [new KeyValuePair<string, object>("page", "/home")]);
SentrySdk.Experimental.Metrics.EmitGauge("page_load", 15.0, SentryUnits.Duration.Millisecond,
    [new KeyValuePair<string, object>("page", "/home")]);
`,
    },
    {
      type: 'text',
      text: tct('For more detailed information, see the [link:metrics documentation].', {
        link: (
          <ExternalLink href="https://docs.sentry.io/platforms/dotnet/metrics/" />
        ),
      }),
    },
  ],
});
