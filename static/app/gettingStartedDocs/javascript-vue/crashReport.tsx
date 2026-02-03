import {widgetCalloutBlock} from 'sentry/components/onboarding/gettingStartedDoc/feedback/widgetCallout';
import type {OnboardingConfig} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {StepType} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportJavaScriptInstallSteps,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';

import type {Params, PlatformOptions} from './utils';

export const crashReport: OnboardingConfig<PlatformOptions> = {
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: Params) => getCrashReportJavaScriptInstallSteps(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({
            link: 'https://docs.sentry.io/platforms/javascript/guides/vue/user-feedback/configuration/#crash-report-modal',
          }),
        },
        widgetCalloutBlock({
          link: 'https://docs.sentry.io/platforms/javascript/guides/vue/user-feedback/#user-feedback-widget',
        }),
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
};
