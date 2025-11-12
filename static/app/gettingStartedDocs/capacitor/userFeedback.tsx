import crashReportCallout from 'sentry/components/onboarding/gettingStartedDoc/feedback/crashReportCallout';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {getFeedbackConfigureDescription} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';

import {onboarding} from './onboarding';
import {getSetupConfiguration, type Params, type PlatformOptions} from './utils';

export const userFeedback: OnboardingConfig<PlatformOptions> = {
  install: (params: Params) => onboarding.install(params),
  configure: (params: Params) => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getFeedbackConfigureDescription({
            linkConfig:
              'https://docs.sentry.io/platforms/javascript/guides/capacitor/user-feedback/configuration/',
            linkButton:
              'https://docs.sentry.io/platforms/javascript/guides/capacitor/user-feedback/configuration/#bring-your-own-button',
          }),
        },
        ...getSetupConfiguration({
          params,
          showExtraStep: false,
          showDescription: false,
        }),
        {
          type: 'text',
          text: crashReportCallout({
            link: 'https://docs.sentry.io/platforms/javascript/guides/capacitor/user-feedback/#crash-report-modal',
          }),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};
