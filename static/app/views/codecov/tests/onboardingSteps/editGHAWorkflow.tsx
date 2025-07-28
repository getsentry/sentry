import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Link} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {InlineCodeSnippet} from 'sentry/views/codecov/styles';
import {OnboardingStep} from 'sentry/views/codecov/tests/onboardingSteps/onboardingStep';

interface EditWorkflowProps {
  step: string;
}

const PERMISSIONS_SNIPPET = `permissions:
    id-token: write
`;

const ACTION_SNIPPET = `- name: Upload test results to Codecov
  if: \${{ !cancelled() }}
  uses: getsentry/prevent-action
`;

export function EditGHAWorkflow({step}: EditWorkflowProps) {
  const headerText = tct('Step [step]: Edit your GitHub Action workflow', {
    step,
  });

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
      <OnboardingStep.Content>
        <TopParagraph>
          <SubHeader>
            {tct(
              'Add [permissions] block at the top level in your CI YAML file to run Sentry Prevent',
              {
                permissions: <InlineCodeSnippet>permissions</InlineCodeSnippet>,
              }
            )}
          </SubHeader>
          <CodeSnippet dark language="yaml">
            {PERMISSIONS_SNIPPET}
          </CodeSnippet>
          <Paragraph>
            {tct(
              'Set this permission at the workflow or job level. For better security, define it at the job level as it limits access to only the job that needs the OIDC token. Learn more about [permissionsSettings].',
              {
                permissionsSettings: <Link to="">{t('permissions settings')}</Link>,
              }
            )}
          </Paragraph>
        </TopParagraph>
        <SubHeader>
          {tct('Add the script [actionName] to your CI YAML file', {
            actionName: <InlineCodeSnippet>getsentry/prevent-action</InlineCodeSnippet>,
          })}
        </SubHeader>
        <Paragraph>
          {t('In your CI YAML file, add below scripts to the end of your test run.')}
        </Paragraph>
        <CodeSnippet dark language="yaml">
          {ACTION_SNIPPET}
        </CodeSnippet>
        <Paragraph>
          {t(
            'This action will download the Sentry Prevent CLI, and upload the junit.xml file generated in the previous step to Sentry.'
          )}
        </Paragraph>
        {/* TODO: add dropdown expansion */}
      </OnboardingStep.Content>
    </OnboardingStep.Container>
  );
}

const SubHeader = styled('div')`
  font-size: ${p => p.theme.fontSize.xl};
  font-weight: ${p => p.theme.fontWeight.bold};
  color: ${p => p.theme.gray300};
  margin-bottom: 0;
  line-height: 31px;
`;

const TopParagraph = styled('div')`
  margin-bottom: ${space(3)};
`;

const Paragraph = styled('div')`
  margin: ${space(1)} 0;
`;
