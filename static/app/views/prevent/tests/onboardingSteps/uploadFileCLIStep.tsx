import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Text} from 'sentry/components/core/text';
import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface UploadFileCLIStepProps {
  previousStep: string;
  step: string;
}

const SNIPPET = `sentry-prevent-cli do-upload --report-type test_results --file <report_name>.junit.xml`;

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
          <StyledP>
            {t(
              'The following snippet instructs the CLI to upload this report to Sentry Prevent.'
            )}
          </StyledP>
          <StyledCodeSnippet dark language="bash">
            {SNIPPET}
          </StyledCodeSnippet>
          <StyledP>
            {tct(
              'Be sure to specify [reportType] as [testResults] and include the file you created in Step [previousStep]. This will not necessarily upload coverage reports to Sentry.',
              {
                reportType: <Text variant="promotion">--report-type</Text>,
                testResults: <Text variant="promotion">test_results</Text>,
                previousStep,
              }
            )}
          </StyledP>
        </OnboardingStep.Content>
      </OnboardingStep.Body>
    </OnboardingStep.Container>
  );
}

const StyledP = styled('p')`
  margin: 0;
`;

const StyledCodeSnippet = styled(CodeSnippet)`
  margin-top: ${p => p.theme.space.md};
  margin-bottom: ${p => p.theme.space.md};

  code {
    text-wrap: wrap;
  }
`;
