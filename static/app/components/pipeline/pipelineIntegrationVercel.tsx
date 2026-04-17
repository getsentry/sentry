import {useCallback} from 'react';

import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

import type {OAuthCallbackData} from './shared/oauthLoginStep';
import {OAuthLoginStep} from './shared/oauthLoginStep';
import type {PipelineDefinition, PipelineStepProps} from './types';
import {pipelineComplete} from './types';

function VercelOAuthLoginStep({
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
      serviceName="Vercel"
      onOAuthCallback={handleOAuthCallback}
    />
  );
}

export const vercelIntegrationPipeline = {
  type: 'integration',
  provider: 'vercel',
  actionTitle: t('Installing Vercel Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing via Vercel OAuth'),
      component: VercelOAuthLoginStep,
    },
  ],
} as const satisfies PipelineDefinition;
