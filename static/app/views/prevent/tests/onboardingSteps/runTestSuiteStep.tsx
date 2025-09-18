import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import testAnalyticsPRCommentDark from 'sentry-images/features/test-analytics-pr-comment-dark.png';
import testAnalyticsPRCommentLight from 'sentry-images/features/test-analytics-pr-comment-light.png';
import testAnalyticsWorkflowLogs from 'sentry-images/features/test-analytics-workflow-logs.svg';

import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface RunTestSuiteStepProps {
  step: string;
}

export function RunTestSuiteStep({step}: RunTestSuiteStepProps) {
  const theme = useTheme();
  const isDarkMode = theme.type === 'dark';

  const headerText = tct('Step [step]: Run your test suite', {
    step,
  });

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Body>
        <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
        <OnboardingStep.Content>
          <StyledP>
            {t(
              'You can inspect the workflow logs to see if the call to Sentry succeeded.'
            )}
          </StyledP>
          <StyledImg src={testAnalyticsWorkflowLogs} />
          <StyledP>
            {t(
              'Run your tests as usual. A failed test is needed to view the failed tests report.'
            )}
          </StyledP>
        </OnboardingStep.Content>
      </OnboardingStep.Body>
      <OnboardingStep.ExpandableDropdown
        triggerContent={
          <div>
            {t(
              'Here are examples of failed test reports in PR comments. Comment generation may take time.'
            )}
          </div>
        }
      >
        <img
          src={isDarkMode ? testAnalyticsPRCommentDark : testAnalyticsPRCommentLight}
        />
      </OnboardingStep.ExpandableDropdown>
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
