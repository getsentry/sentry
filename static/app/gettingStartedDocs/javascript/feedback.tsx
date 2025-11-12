import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigureDescription} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';
import {tct} from 'sentry/locale';

import {getSdkSetupSnippet, installSnippetBlock, type PlatformOptions} from './utils';

export const feedback: OnboardingConfig<PlatformOptions> = {
  install: () => [
    {
      type: StepType.INSTALL,
      content: [
        {
          type: 'text',
          text: tct(
            'For the User Feedback integration to work, you must have the Sentry browser SDK package, or an equivalent framework SDK (e.g. [code:@sentry/react]) installed, minimum version 7.85.0.',
            {
              code: <code />,
            }
          ),
        },
        installSnippetBlock,
      ],
    },
  ],
  configure: params => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getFeedbackConfigureDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/javascript/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/javascript/user-feedback/configuration/#bring-your-own-button',
          }),
        },
        {
          type: 'code',
          language: 'javascript',
          code: getSdkSetupSnippet(params),
        },
        {
          type: 'text',
          text: crashReportCallout({
            link: 'https://docs.sentry.io/platforms/javascript/user-feedback/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};
