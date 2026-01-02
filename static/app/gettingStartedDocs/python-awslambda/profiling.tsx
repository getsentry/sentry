import {
  StepType,
  type DocsParams,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

import {configureStep, installStep} from './utils';

export const profiling: OnboardingConfig = {
  install: () => [installStep()],
  configure: (params: DocsParams) => [configureStep(params)],
  verify: () => [
    {
      type: StepType.VERIFY,
      content: [
        {
          type: 'text',
          text: t(
            'Verify that profiling is working correctly by simply using your application.'
          ),
        },
      ],
    },
  ],
};
