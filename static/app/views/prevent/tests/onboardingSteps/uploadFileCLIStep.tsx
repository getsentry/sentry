import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Text} from 'sentry/components/core/text';
import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface UploadFileCLIStepProps {
  previousStep: string;
  step: string;
}

const SNIPPET = `
sentry-prevent-cli do-upload \\
  --report-type test_results \\
  --file <report_name>.junit.xml
`.trim();

export function UploadFileCLIStep({previousStep, step}: UploadFileCLIStepProps) {
  const headerText = tct(
    'Step [step]: Upload this file to Sentry Prevent using the CLI',
    {
      step,
    }
  );

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Body>
        <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
        <OnboardingStep.Content>
          <Text>
            {t(
              'The following snippet instructs the CLI to upload this report to Sentry Prevent.'
            )}
          </Text>
          <CodeSnippet dark language="bash">
            {SNIPPET}
          </CodeSnippet>
          <Text>
            {tct(
              'Be sure to specify [code:--report-type] as [code:test_results] and include the file you created in Step [previousStep]. This will not necessarily upload coverage reports to Sentry.',
              {
                code: <code />,
                previousStep,
              }
            )}
          </Text>
        </OnboardingStep.Content>
      </OnboardingStep.Body>
    </OnboardingStep.Container>
  );
}
