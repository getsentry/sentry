import {ExternalLink} from '@sentry/scraps/link';

import {tracePropagationBlock} from 'sentry/components/onboarding/gettingStartedDoc/replay/tracePropagationMessage';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {getMainConfigSnippet, getRendererConfigSnippet, installCodeBlock} from './utils';

const getVerifySnippet = (params: DocsParams) => {
  const logsCode = params.isLogsSelected
    ? `
      // Send a log before throwing the error
      Sentry.logger.info('User triggered test error', {
        action: 'test_error_button_click',
      });`
    : '';

  const metricsCode = params.isMetricsSelected
    ? `
      // Send a test metric before throwing the error
      Sentry.metrics.count('test_counter', 1);`
    : '';

  return {
    main: `import { app } from "electron";
import * as Sentry from "@sentry/electron/main";

app.on("ready", () => {${logsCode}${metricsCode}
  throw new Error("Sentry test error in main process");
});`,
    renderer: `document.getElementById("testError").addEventListener("click", () => {${logsCode}${metricsCode}
  throw new Error("Sentry test error in renderer process");
});`,
  };
};

export const onboarding: OnboardingConfig = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: t('Add the Sentry Electron SDK package as a dependency:'),
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
          text: tct(
            'You need to call [code:Sentry.init] in both the [code:main] process and every [code:renderer] process you spawn. The main process manages shared configuration (DSN, release, environment), while renderer processes handle browser-specific features like Session Replay and tracing. For more details about configuring the Electron SDK [docsLink:click here].',
            {
              code: <code />,
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/electron/" />
              ),
            }
          ),
        },
        {
          type: 'text',
          text: t('Main Process:'),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getMainConfigSnippet(params),
        },
        {
          type: 'text',
          text: t('Renderer Process(es):'),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getRendererConfigSnippet(params),
        },
        {
          type: 'conditional',
          condition: params.isReplaySelected,
          content: [tracePropagationBlock],
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink:
        'https://docs.sentry.io/platforms/javascript/guides/electron/sourcemaps/',
      ...params,
    }),
  ],
  verify: params => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'To verify your setup, you can trigger errors from both the main and renderer processes.'
          ),
        },
        {
          type: 'text',
          text: t('Main process error - Add an event listener that throws an error:'),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getVerifySnippet(params).main,
        },
        {
          type: 'text',
          text: t(
            'Renderer process error - Add a test button to one of your HTML pages:'
          ),
        },
        {
          type: 'code',
          language: 'html',
          filename: 'index.html',
          code: `<button id="testError">Break the world</button>

<script src="renderer.js"></script>`,
        },
        {
          type: 'text',
          text: t('Then, in your renderer process JavaScript:'),
        },
        {
          type: 'code',
          language: 'javascript',
          filename: 'renderer.js',
          code: getVerifySnippet(params).renderer,
        },
        {
          type: 'text',
          text: t(
            'Start your app and trigger the errors. You should see events appear in your Sentry project.'
          ),
        },
        ...(params.isPerformanceSelected
          ? [
              {
                type: 'text' as const,
                text: t(
                  'With performance monitoring enabled, renderer process navigation and user interactions will automatically create transactions.'
                ),
              },
            ]
          : []),
      ],
    },
  ],
  nextSteps: (params: DocsParams) => {
    const steps = [
      {
        id: 'electron-features',
        name: t('Electron Features'),
        description: t(
          'Learn about Electron-specific features like native crash reporting and offline storage.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/electron/features/',
      },
    ];

    if (params.isLogsSelected) {
      steps.push({
        id: 'logs',
        name: t('Logs'),
        description: t(
          'Learn how to configure structured application logs for debugging.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/electron/logs/',
      });
    }

    if (params.isMetricsSelected) {
      steps.push({
        id: 'metrics',
        name: t('Application Metrics'),
        description: t('Track custom metrics to monitor your application performance.'),
        link: 'https://docs.sentry.io/platforms/javascript/guides/electron/metrics/',
      });
    }

    if (params.isPerformanceSelected) {
      steps.push({
        id: 'tracing',
        name: t('Tracing'),
        description: t('Track performance across your main and renderer processes.'),
        link: 'https://docs.sentry.io/platforms/javascript/guides/electron/tracing/',
      });
    }

    if (params.isReplaySelected) {
      steps.push({
        id: 'session-replay',
        name: t('Session Replay'),
        description: t(
          'Replay user sessions to understand issues in your Electron renderer.'
        ),
        link: 'https://docs.sentry.io/platforms/javascript/guides/electron/session-replay/',
      });
    }

    return steps;
  },
};
