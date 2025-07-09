import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {t, tct} from 'sentry/locale';
import {OnboardingStep} from 'sentry/views/codecov/tests/onboardingSteps/onboardingStep';

interface UploadFileProps {
  step: string;
}

const SNIPPET = `sentry-prevent-cli do-upload --report-type test_results --file <report_name>.junit.xml`;

export function UploadFileUsingCLI({step}: UploadFileProps) {
  const headerText = tct(
    'Step [step]: Upload this file to Sentry Prevent using the CLI',
    {
      step,
    }
  );

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
      <OnboardingStep.Content>
        <p>
          {t(
            'The following snippet instructs the CLI to to upload this report to Sentry.'
          )}
        </p>
        <CodeSnippet dark language="bash">
          {SNIPPET}
        </CodeSnippet>
        <p>
          {tct(
            'Be sure to specify [reportType] as [testResults] and include the file you created in Step 3. This will not necessarily upload coverage reports to Sentry.',
            {
              reportType: <ColoredText>--report-type</ColoredText>,
              testResults: <ColoredText>test_results</ColoredText>,
            }
          )}
        </p>
        {/* TODO: add dropdown expansion */}
      </OnboardingStep.Content>
    </OnboardingStep.Container>
  );
}

// const InlineCodeSnippet = styled('span')`
//   background-color: ${p => p.theme.black};
//   color: ${p => p.theme.white};
//   font-family: ${p => p.theme.text.familyMono};
//   font-size: ${p => p.theme.fontSizeSmall};
//   font-weight: ${p => p.theme.fontWeightBold};
//   border-radius: ${p => p.theme.borderRadius};
//   padding: ${space(0.75)} ${space(1)};
//   line-height: 1;
// `;

const ColoredText = styled('span')`
  color: ${p => p.theme.tokens.content.promotion};
`;
