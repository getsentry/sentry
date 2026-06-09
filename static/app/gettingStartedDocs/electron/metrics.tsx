import {ExternalLink} from '@sentry/scraps/link';

import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t, tct} from 'sentry/locale';

import {installCodeBlock} from './utils';

const getConfigureSnippet = (params: DocsParams) => ({
  main: `
import * as Sentry from "@sentry/electron/main";

Sentry.init({
  dsn: "${params.dsn.public}",
});`,
  renderer: `
import * as Sentry from "@sentry/electron/renderer";

Sentry.init({
  // Metrics are sent through the main process
});`,
});

const getVerifySnippet = () => ({
  main: `
import * as Sentry from "@sentry/electron/main";

// Send a custom counter metric
Sentry.metrics.count('app.startup', 1, {
  attributes: { process: 'main' },
});

// Send a gauge metric
Sentry.metrics.gauge('memory.used', process.memoryUsage().heapUsed, {
  unit: 'byte',
  attributes: { process: 'main' },
});`,
  renderer: `
import * as Sentry from "@sentry/electron/renderer";

// Send a custom counter metric from renderer
Sentry.metrics.count('button.click', 1, {
  attributes: { component: 'test-button' },
});

// Send a distribution metric
Sentry.metrics.distribution('page.load_time', 1234, {
  unit: 'millisecond',
  attributes: { page: 'home' },
});`,
});

export const metrics: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Metrics support is included in [code:@sentry/electron] version [code:7.5.0] and above.',
            {
              code: <code />,
            }
          ),
        },
        installCodeBlock,
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
            'Metrics are automatically enabled. You can emit metrics from both main and renderer processes:'
          ),
        },
        {
          type: 'text',
          text: t('Main Process:'),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getConfigureSnippet(params).main,
        },
        {
          type: 'text',
          text: t('Renderer Process:'),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getConfigureSnippet(params).renderer,
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
          text: t('Send test metrics from both processes to verify your setup:'),
        },
        {
          type: 'text',
          text: t('Main Process:'),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getVerifySnippet().main,
        },
        {
          type: 'text',
          text: t('Renderer Process:'),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getVerifySnippet().renderer,
        },
        {
          type: 'text',
          text: t(
            'After running your application and emitting metrics, you should see them appear in your Sentry project metrics dashboard.'
          ),
        },
        {
          type: 'text',
          text: tct(
            'For more detailed information, see the [link:metrics documentation].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/electron/metrics/" />
              ),
            }
          ),
        },
      ],
    },
  ],
};
