import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import type {
  DocsParams,
  OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getFeedbackConfigureDescription,
  getFeedbackSDKSetupSnippet,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {tct} from 'sentry/locale';

import {getInstallContent} from './utils';

export const feedback: OnboardingConfig = {
  install: (params: DocsParams) => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/nuxt]) installed, minimum version 7.85.0.',
            {
              code: <code />,
            }
          ),
        },
        ...getInstallContent(params),
      ],
    },
  ],
  configure: (params: DocsParams) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getFeedbackConfigureDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/javascript/guides/nuxt/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/javascript/guides/nuxt/user-feedback/configuration/#bring-your-own-button',
          }),
        },
        {
          type: 'code',
          tabs: [
            {
              label: 'JavaScript',
              language: 'javascript',
              code: getFeedbackSDKSetupSnippet({
                importStatement: `import * as Sentry from "@sentry/nuxt";`,
                dsn: params.dsn.public,
                feedbackOptions: params.feedbackOptions,
              }),
            },
          ],
        },
        {
          type: 'custom',
          content: crashReportCallout({
            link: 'https://docs.sentry.io/platforms/javascript/guides/nuxt/user-feedback/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};
