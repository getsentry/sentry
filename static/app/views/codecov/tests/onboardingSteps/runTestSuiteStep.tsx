import styled from '@emotion/styled';

import testAnalyticsWorkflowLogs from 'sentry-images/features/test-analytics-workflow-logs.svg';

import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/codecov/tests/onboardingSteps/onboardingStep';

interface RunTestSuiteStepProps {
  step: string;
}

export function RunTestSuiteStep({step}: RunTestSuiteStepProps) {
  const headerText = tct('Step [step]: Run your test suite', {
    step,
  });

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
      <OnboardingStep.Content>
        <StyledP>
          {t('You can inspect the workflow logs to see if the call to Sentry succeeded.')}
        </StyledP>
        <StyledImg src={testAnalyticsWorkflowLogs} />
        <StyledP>
          {t(
            'Run your tests as usual. A failed test is needed to view the failed tests report.'
          )}
        </StyledP>
        {/* TODO: add dropdown expansion */}
      </OnboardingStep.Content>
    </OnboardingStep.Container>
  );
}

const StyledImg = styled('img')`
  margin-top: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};
`;

const StyledP = styled('p')`
  margin: 0;
`;
