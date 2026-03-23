import {
  StepType,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {
  getCrashReportGenericInstallSteps,
  getCrashReportModalConfigDescription,
  getCrashReportModalIntroduction,
} from 'sentry/components/onboarding/gettingStartedDoc/utils/feedbackOnboarding';

export const crashReport = ({docsLink}: {docsLink: string}): OnboardingConfig => ({
  introduction: () => getCrashReportModalIntroduction(),
  install: (params: DocsParams) => getCrashReportGenericInstallSteps(params),
  configure: () => [
    {
      type: StepType.CONFIGURE,
      content: [
        {
          type: 'text',
          text: getCrashReportModalConfigDescription({link: docsLink}),
        },
      ],
    },
  ],
  verify: () => [],
  nextSteps: () => [],
});
