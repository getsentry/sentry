import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {InlineCodeSnippet} from 'sentry/views/codecov/styles';
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
        {/* TODO: add dropdown expansion */}
      </OnboardingStep.Content>
    </OnboardingStep.Container>
  );
}

const AddScriptsParagraph = styled('div')`
  margin-bottom: ${space(1)};
`;

const SnippetFollowupParagraph = styled('div')`
  margin-top: ${space(1.5)};
`;
