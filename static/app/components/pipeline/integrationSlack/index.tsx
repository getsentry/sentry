import {useCallback} from 'react';

import type {OAuthCallbackData} from 'sentry/components/pipeline/shared/oauthLoginStep';
import {OAuthLoginStep} from 'sentry/components/pipeline/shared/oauthLoginStep';
import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/utils';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

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
      oauthUrl={stepData?.oauthUrl}
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
  completionView: null,
  steps: [
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing via Slack OAuth'),
      component: SlackOAuthLoginStep,
    },
  ],
} as const satisfies PipelineDefinition;

export const slackStagingIntegrationPipeline = {
  type: 'integration',
  provider: 'slack_staging',
  actionTitle: t('Installing Slack (Staging) Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing via Slack OAuth'),
      component: SlackOAuthLoginStep,
    },
  ],
} as const satisfies PipelineDefinition;
