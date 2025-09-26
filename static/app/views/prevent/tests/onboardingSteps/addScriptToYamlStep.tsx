import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Text} from 'sentry/components/core/text';
import {t, tct} from 'sentry/locale';
import {GHAWorkflowExpandable} from 'sentry/views/prevent/tests/onboardingSteps/GHAWorkflowExpandable';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface AddScriptToYamlStepProps {
  step: string;
}

const SNIPPET = `- name: Upload test results to Sentry Prevent
  if: \${{ !cancelled() }}
  uses: getsentry/prevent-action@v0
  with:
    token: \${{ secrets.SENTRY_PREVENT_TOKEN }}
`;

export function AddScriptToYamlStep({step}: AddScriptToYamlStepProps) {
  const headerText = tct(
    'Step [step]: Add the script [actionName] to your CI YAML file',
    {
      step,
      actionName: (
        <Text size="xl" variant="promotion">
          {t('permissions')}
        </Text>
      ),
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
