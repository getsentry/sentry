import {useCallback} from 'react';

import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

import type {OAuthCallbackData} from './shared/oauthLoginStep';
import {OAuthLoginStep} from './shared/oauthLoginStep';
import type {PipelineDefinition, PipelineStepProps} from './types';
import {pipelineComplete} from './types';

function SlackOAuthLoginStep({
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
      serviceName="Slack"
      onOAuthCallback={handleOAuthCallback}
      popup={{height: 900}}
    />
  );
}

export const slackIntegrationPipeline = {
  type: 'integration',
  provider: 'slack',
  actionTitle: t('Installing Slack Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  steps: [
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing via Slack OAuth'),
      component: SlackOAuthLoginStep,
    },
  ],
} as const satisfies PipelineDefinition;
