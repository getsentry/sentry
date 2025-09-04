import styled from '@emotion/styled';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import {Link} from 'sentry/components/core/link';
import {t, tct} from 'sentry/locale';
import {InlineCodeSnippet} from 'sentry/views/prevent/styles';
import {GHAWorkflowExpandable} from 'sentry/views/prevent/tests/onboardingSteps/GHAWorkflowExpandable';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface EditGHAWorkflowStepProps {
  step: string;
}

const PERMISSIONS_SNIPPET = `permissions:
    id-token: write
`;

const ACTION_SNIPPET = `- name: Upload test results to Codecov
  if: \${{ !cancelled() }}
  uses: getsentry/prevent-action
`;

export function EditGHAWorkflowStep({step}: EditGHAWorkflowStepProps) {
  const headerText = tct('Step [step]: Edit your GitHub Actions workflow', {
    step,
  });

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Body>
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
                  permissionsSettings: (
                    <Link to="https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers#adding-permissions-settings">
                      {t('permissions settings')}
                    </Link>
                  ),
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
        </OnboardingStep.Content>
      </OnboardingStep.Body>
      <GHAWorkflowExpandable />
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
  margin-bottom: ${p => p.theme.space['2xl']};
`;

const Paragraph = styled('div')`
  margin: ${p => p.theme.space.md} 0;
`;
