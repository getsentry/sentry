import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OnboardingStep} from 'sentry/views/codecov/tests/onboardingSteps/onboardingStep';

interface OutputCoverageFileProps {
  step: string;
}

const SNIPPET = `- name: Upload test results to Codecov
  if: \${{ !cancelled() }}
  uses: codecov/test-results-action@v1
  with:
    token: \${{ secrets.CODECOV_TOKEN }}
`;

export function AddScriptToYaml({step}: OutputCoverageFileProps) {
  const headerText = tct(
    'Step [step]: Add the script [actionName] to your CI YAML file',
    {
      step,
      actionName: <InlineCodeSnippet>{t('permissions')}</InlineCodeSnippet>,
    }
  );

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
      <OnboardingStep.Content>
        <p>{t('In your CI YAML file, add below scripts to the end of your test run.')}</p>
        <CodeSnippet dark language="yaml">
          {SNIPPET}
        </CodeSnippet>
        <p>
          {t(
            'This action will download the Sentry Prevent CLI, and upload the junit.xml file generated in the previous step to Sentry.'
          )}
        </p>
        {/* TODO: add dropdown expansion */}
      </OnboardingStep.Content>
    </OnboardingStep.Container>
  );
}

const InlineCodeSnippet = styled('span')`
  background-color: ${p => p.theme.black};
  color: ${p => p.theme.white};
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: ${p => p.theme.fontWeightBold};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(0.75)} ${space(1)};
  line-height: 1;
`;
