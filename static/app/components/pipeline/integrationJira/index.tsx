import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/utils';
import {t, tct} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

interface JiraConfirmStepData {
  baseUrl: string;
  organization: string;
  state: string;
}

function JiraConfirmInstallStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<JiraConfirmStepData, {state: string}>) {
  // Jira installs are initiated from the Atlassian Marketplace, so the install
  // data is already bound to pipeline state by the time the modal opens. We do
  // NOT auto-advance: a copied install link could connect an attacker's Jira
  // workspace to a victim's org, so we surface the workspace and organization
  // and require an explicit confirmation before installing.
  return (
    <Stack gap="lg" align="start">
      <Heading as="h3">{t('Connect Jira to Sentry')}</Heading>

      <Text>
        {tct(
          'You are about to connect a Jira workspace to the [organization] Sentry organization. Anyone in the organization will be able to create and link Jira issues using this installation.',
          {
            organization: (
              <Text as="span" bold>
                {stepData?.organization}
              </Text>
            ),
          }
        )}
      </Text>

      {stepData?.baseUrl && (
        <Text>
          {t('Jira workspace:')}{' '}
          <Text as="span" bold>
            {stepData.baseUrl}
          </Text>
        </Text>
      )}

      <Text variant="warning">
        {t(
          'If you did not start this installation yourself, do not continue — the link may have been sent to you by someone else.'
        )}
      </Text>

      <Button
        variant="primary"
        busy={isAdvancing}
        disabled={!stepData}
        onClick={() => stepData && advance({state: stepData.state})}
      >
        {t('Install Jira integration')}
      </Button>
    </Stack>
  );
}

export const jiraIntegrationPipeline = {
  type: 'integration',
  provider: 'jira',
  actionTitle: t('Installing Jira Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'jira_confirm_install',
      shortDescription: t('Confirming installation'),
      component: JiraConfirmInstallStep,
    },
  ],
} as const satisfies PipelineDefinition;
