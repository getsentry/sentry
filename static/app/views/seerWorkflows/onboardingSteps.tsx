import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

export type OnboardingStep = {
  body: React.ReactNode;
  title: string;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: t('Welcome to Sentry Workflows'),
    body: (
      <Text as="p">
        {t(
          'Sentry runs daily workflows like agentic triage and feedback summaries for your organization. This page shows the history of every run.'
        )}
      </Text>
    ),
  },
];
