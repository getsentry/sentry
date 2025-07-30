import styled from '@emotion/styled';

import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/codecov/tests/onboardingSteps/onboardingStep';

interface ViewResultsInsightsStepProps {
  step: string;
}

export function ViewResultsInsightsStep({step}: ViewResultsInsightsStepProps) {
  const headerText = tct('Step [step]: View results and insights', {
    step,
  });

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
      <OnboardingStep.Content>
        <StyledP>
          {t(
            "After the test run completion, you'll be able to see the failed tests result in the following areas:"
          )}
        </StyledP>
        <StyledUl>
          <li>{t('GitHub pull request comment')}</li>
          <li>{t('Failed tests dashboard here')}</li>
        </StyledUl>
      </OnboardingStep.Content>
    </OnboardingStep.Container>
  );
}

const StyledP = styled('p')`
  margin: 0;
`;

const StyledUl = styled('ul')`
  margin: 0;
`;
