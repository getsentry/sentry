import {useCallback} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

import type {OAuthCallbackData} from './shared/oauthLoginStep';
import {OAuthLoginStep} from './shared/oauthLoginStep';
import type {PipelineDefinition, PipelineStepProps} from './types';
import {pipelineComplete} from './types';

interface VstsAccount {
  accountId: string;
  accountName: string;
}

interface VstsAccountSelectionStepData {
  accounts?: VstsAccount[];
}

interface VstsAccountSelectionAdvanceData {
  account: string;
}

function VstsOAuthLoginStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<{oauthUrl?: string}, {code: string; state: string}>) {
  const handleOAuthCallback = useCallback(
    (data: OAuthCallbackData) => {
      advance({code: data.code, state: data.state});
    },
    [advance]
  );

  return (
    <OAuthLoginStep
      oauthUrl={stepData.oauthUrl}
      isLoading={isAdvancing}
      serviceName="Azure DevOps"
      onOAuthCallback={handleOAuthCallback}
    />
  );
}

function VstsAccountSelectionStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<VstsAccountSelectionStepData, VstsAccountSelectionAdvanceData>) {
  const accounts = stepData.accounts ?? [];

  if (accounts.length === 0) {
    return (
      <Alert variant="info">
        {t(
          'No Azure DevOps organizations were found for this account. Make sure you are an owner or admin on the Azure DevOps organization you want to connect.'
        )}
      </Alert>
    );
  }

  return (
    <Stack gap="lg" align="start">
      <Text>
        {t('Select the Azure DevOps organization you want to connect to Sentry.')}
      </Text>
      <DropdownMenu
        triggerLabel={t('Select Azure DevOps organization')}
        items={accounts.map(account => ({
          key: account.accountId,
          label: account.accountName,
        }))}
        isDisabled={isAdvancing}
        onAction={key => {
          advance({account: key as string});
        }}
      />
    </Stack>
  );
}

export const vstsIntegrationPipeline = {
  type: 'integration',
  provider: 'vsts',
  actionTitle: t('Installing Azure DevOps Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing via Azure DevOps OAuth'),
      component: VstsOAuthLoginStep,
    },
    {
      stepId: 'account_selection',
      shortDescription: t('Selecting Azure DevOps organization'),
      component: VstsAccountSelectionStep,
    },
  ],
} as const satisfies PipelineDefinition;
