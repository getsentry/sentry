import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {t, tct} from 'sentry/locale';
import {InlineCodeSnippet} from 'sentry/views/prevent/styles';
import {GHAWorkflowExpandable} from 'sentry/views/prevent/tests/onboardingSteps/GHAWorkflowExpandable';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface AddScriptToYamlStepProps {
  step: string;
}

const SNIPPET = `- name: Upload test results to Codecov
  if: \${{ !cancelled() }}
  uses: codecov/test-results-action@v1
  with:
    token: \${{ secrets.CODECOV_TOKEN }}
`;

export function AddScriptToYamlStep({step}: AddScriptToYamlStepProps) {
  const headerText = tct(
    'Step [step]: Add the script [actionName] to your CI YAML file',
    {
      step,
      actionName: <InlineCodeSnippet>{t('permissions')}</InlineCodeSnippet>,
    }
  );

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Body>
        <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
        <OnboardingStep.Content>
          <AddScriptsParagraph>
            {t('In your CI YAML file, add below scripts to the end of your test run.')}
          </AddScriptsParagraph>
          <CodeSnippet dark language="yaml">
            {SNIPPET}
          </CodeSnippet>
          <SnippetFollowupParagraph>
            {t(
              'This action will download the Sentry Prevent CLI, and upload the junit.xml file generated in the previous step to Sentry.'
            )}
          </SnippetFollowupParagraph>
        </OnboardingStep.Content>
      </OnboardingStep.Body>
      <GHAWorkflowExpandable />
    </OnboardingStep.Container>
  );
}

const AddScriptsParagraph = styled('div')`
  margin-bottom: ${p => p.theme.space.md};
`;

const SnippetFollowupParagraph = styled('div')`
  margin-top: ${p => p.theme.space.lg};
`;
