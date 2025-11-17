import {ExternalLink} from 'sentry/components/core/link';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getUploadSourceMapsStep} from 'sentry/components/onboarding/gettingStartedDoc/utils';
import {t, tct} from 'sentry/locale';

import {installCodeBlock} from './utils';

const getConfigureSnippet = (params: DocsParams) => `
import * as Sentry from "@sentry/electron";

Sentry.init({
  dsn: "${params.dsn.public}",
});`;

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
            'You need to call [code:Sentry.init] in the [code:main] process and in every [code:renderer] process you spawn. For more details about configuring the Electron SDK [docsLink:click here].',
            {
              code: <code />,
              docsLink: (
                <ExternalLink href="https://docs.sentry.io/platforms/javascript/guides/electron/" />
              ),
            }
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getConfigureSnippet(params),
        },
      ],
    },
    getUploadSourceMapsStep({
      guideLink:
        'https://docs.sentry.io/platforms/javascript/guides/electron/sourcemaps/',
      ...params,
    }),
  ],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            `One way to verify your setup is by intentionally causing an error that breaks your application.`
          ),
        },
        {
          type: 'text',
          text: t(`Calling an undefined function will throw a JavaScript exception:`),
        },
        {
          type: 'code',
          language: 'javascript',
          code: 'myUndefinedFunction();',
        },
        {
          type: 'text',
          text: t(
            `With Electron you can test native crash reporting by triggering a crash:`
          ),
        },
        {
          type: 'code',
          language: 'javascript',
          code: 'process.crash();',
        },
        {
          type: 'text',
          text: t(
            'You may want to try inserting these code snippets into both your main and any renderer processes to verify Sentry is operational in both.'
          ),
        },
      ],
    },
  ],
};
