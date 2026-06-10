import {useCallback, useEffect, useRef} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import type {OAuthCallbackData} from 'sentry/components/pipeline/shared/oauthLoginStep';
import {OAuthLoginStep} from 'sentry/components/pipeline/shared/oauthLoginStep';
import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/utils';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

interface VstsAccount {
  accountId: string;
  accountName: string;
}

interface VstsAccountSelectionStepData {
  // Present for Marketplace installs: the pre-selected (and server-verified)
  // account id. When set, the step advances without prompting.
  account?: string;
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
      oauthUrl={stepData?.oauthUrl}
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
  // Marketplace installs pre-select the account (verified server-side), which
  // the backend surfaces as `account`. Advance immediately without prompting.
  // The ref guards against React strict mode double-firing the effect.
  const hasAutoAdvanced = useRef(false);
  const preselectedAccount = stepData?.account;
  useEffect(() => {
    if (!preselectedAccount || hasAutoAdvanced.current) {
      return;
    }
    hasAutoAdvanced.current = true;
    advance({account: preselectedAccount});
  }, [preselectedAccount, advance]);

  if (stepData === null) {
    return null;
  }

  if (preselectedAccount) {
    return <Text>{t('Finishing up Azure DevOps integration installation...')}</Text>;
  }

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
