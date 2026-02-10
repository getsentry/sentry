import {Text} from '@sentry/scraps/text';

import List from 'sentry/components/list';
import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface ViewResultsInsightsStepProps {
  step: string;
}

export function ViewResultsInsightsStep({step}: ViewResultsInsightsStepProps) {
  const headerText = tct('Step [step]: View results and insights', {
    step,
  });

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Body>
        <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
        <OnboardingStep.Content>
          <Text>
            {t(
              "After the test run completion, you'll be able to see the failed tests result in the following areas:"
            )}
          </Text>
          <List symbol="bullet">
            <li>{t('GitHub pull request comment')}</li>
            <li>{t('Tests Analytics dashboard here')}</li>
          </List>
        </OnboardingStep.Content>
      </OnboardingStep.Body>
    </OnboardingStep.Container>
  );
}
