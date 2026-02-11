import {useTheme} from '@emotion/react';

import testAnalyticsPRCommentDark from 'sentry-images/features/test-analytics-pr-comment-dark.png';
import testAnalyticsPRCommentLight from 'sentry-images/features/test-analytics-pr-comment-light.png';

import {CodeBlock} from '@sentry/scraps/code';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface RunTestSuiteStepProps {
  step: string;
}

const WORKFLOW_LOGS_SNIPPET = `
98  info - 2024-02-09 13:40:22,646 -- Found 1 test_results files to upload
99  info - 2024-02-09 13:40:22,646 -- > /home/runner/work/mcos/mcos/thebeast/mcos.junit.xml
100 info - 2024-02-09 13:40:22,728 -- Process Upload Complete
`.trim();

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
          <Text>
            {t(
              'You can inspect the workflow logs to see if the call to Sentry succeeded.'
            )}
          </Text>
          <CodeBlock language="text" dark hideCopyButton>
            {WORKFLOW_LOGS_SNIPPET}
          </CodeBlock>
          <Text>
            {t(
              'Run your tests as usual. A failed test is needed to view the failed tests report.'
            )}
          </Text>
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
