import {useCallback} from 'react';

import type {OAuthCallbackData} from 'sentry/components/pipeline/shared/oauthLoginStep';
import {OAuthLoginStep} from 'sentry/components/pipeline/shared/oauthLoginStep';
import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

function VstsExtensionOAuthLoginStep({
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

// The Azure DevOps Marketplace install reuses the main provider's OAuth step,
// but unlike the in-app `vsts` pipeline there is no account-selection step: the
// Marketplace already determined the account and bound it to pipeline state, so
// OAuth alone completes the install.
export const vstsExtensionIntegrationPipeline = {
  type: 'integration',
  provider: 'vsts-extension',
  actionTitle: t('Installing Azure DevOps Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing via Azure DevOps OAuth'),
      component: VstsExtensionOAuthLoginStep,
    },
  ],
} as const satisfies PipelineDefinition;
