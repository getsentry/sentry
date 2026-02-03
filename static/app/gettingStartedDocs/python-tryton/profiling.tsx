import {
  StepType,
  type OnboardingConfig,
} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';

import {onboarding} from './onboarding';

export const profiling: OnboardingConfig = {
  install: onboarding.install,
  configure: onboarding.configure,
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
