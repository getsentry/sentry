import {CodeBlock} from '@sentry/scraps/code';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {GHAWorkflowExpandable} from 'sentry/views/prevent/tests/onboardingSteps/GHAWorkflowExpandable';
import {OnboardingStep} from 'sentry/views/prevent/tests/onboardingSteps/onboardingStep';

interface EditGHAWorkflowStepProps {
  step: string;
}

const PERMISSIONS_SNIPPET = `
permissions:
    id-token: write
`.trim();

const ACTION_SNIPPET = `
- name: Upload test results to Sentry Prevent
  if: \${{ !cancelled() }}
  uses: getsentry/prevent-action@v0
`.trim();

export function EditGHAWorkflowStep({step}: EditGHAWorkflowStepProps) {
  const headerText = tct('Step [step]: Edit your GitHub Actions workflow', {
    step,
  });

  return (
    <OnboardingStep.Container>
      <OnboardingStep.Body>
        <OnboardingStep.Header>{headerText}</OnboardingStep.Header>
        <OnboardingStep.Content>
          <Text>
            {tct(
              'Add the [code:permissions] block at the top level in your CI YAML file to run Sentry Prevent',
              {
                code: <code />,
              }
            )}
          </Text>
          <CodeBlock dark language="yaml">
            {PERMISSIONS_SNIPPET}
          </CodeBlock>
          <Text>
            {tct(
              'Set this permission at the workflow or job level. For better security, define it at the job level as it limits access to only the job that needs the OIDC token. Learn more about [link:permissions settings].',
              {
                link: (
                  <ExternalLink href="https://docs.github.com/en/actions/how-tos/secure-your-work/security-harden-deployments/oidc-in-cloud-providers#adding-permissions-settings" />
                ),
              }
            )}
          </Text>
          <Heading as="h4" size="md">
            {tct(
              'Add the workflow action [code:getsentry/prevent-action@v0] to your CI YAML file',
              {
                code: <code />,
              }
            )}
          </Heading>
          <Text>
            {t('In your CI YAML file, add below scripts to the end of your test run.')}
          </Text>
          <CodeBlock dark language="yaml">
            {ACTION_SNIPPET}
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
