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
  enableLogs: true,
});`,
  renderer: `
import * as Sentry from "@sentry/electron/renderer";

Sentry.init({
  enableLogs: true,
});`,
});

const getVerifySnippet = () => ({
  main: `
import * as Sentry from "@sentry/electron/main";

// Send a log from the main process
Sentry.logger.info('Application started', {
  process: 'main',
  timestamp: Date.now(),
});`,
  renderer: `
import * as Sentry from "@sentry/electron/renderer";

// Send a log from the renderer process
Sentry.logger.info('Renderer loaded', {
  process: 'renderer',
  url: window.location.href,
});`,
});

export const logs: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'Logs support is included in [code:@sentry/electron] version [code:6.7.0] and above.',
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
            'Enable logs in both your main and renderer process initialization by setting enableLogs to true:'
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
          text: t('Send a test log from both processes to verify your setup:'),
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
            'After running your application, you should see these logs appear in your Sentry project.'
          ),
        },
        {
          type: 'text',
          text: tct('For more detailed information, see the [link:logs documentation].', {
            link: (
              <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/electron/logs/" />
            ),
          }),
        },
      ],
    },
  ],
};
