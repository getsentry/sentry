import {CodeBlock} from '@sentry/scraps/code';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {GHAWorkflowExpandable} from 'sentry/views/prevent/tests/onboardingSteps/GHAWorkflowExpandable';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface AddScriptToYamlStepProps {
  step: string;
}

const SNIPPET = `
- name: Upload test results to Sentry Prevent
  if: \${{ !cancelled() }}
  uses: getsentry/prevent-action@v0
  with:
    token: \${{ secrets.SENTRY_PREVENT_TOKEN }}
`.trim();

export function AddScriptToYamlStep({step}: AddScriptToYamlStepProps) {
  const headerText = tct(
    'Step [step]: Add the workflow action [code:getsentry/prevent-action@v0] to your CI YAML file',
    {
      step,
      code: <code />,
    }
  );

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Body>
        <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
        <OnboardingStep.Content>
          <Text>
            {t('In your CI YAML file, add below scripts to the end of your test run.')}
          </Text>
          <CodeBlock dark language="yaml">
            {SNIPPET}
          </CodeBlock>
          <Text>
            {t(
              'This action will download the Sentry Prevent CLI, and upload the junit.xml file generated in the previous step to Sentry.'
            )}
          </Text>
        </OnboardingStep.Content>
      </OnboardingStep.Body>
      <GHAWorkflowExpandable />
    </OnboardingStep.Container>
  );
}
