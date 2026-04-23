import {useCallback} from 'react';

import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

import type {OAuthCallbackData} from './shared/oauthLoginStep';
import {OAuthLoginStep} from './shared/oauthLoginStep';
import type {PipelineDefinition, PipelineStepProps} from './types';
import {pipelineComplete} from './types';

function DiscordOAuthLoginStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<
  {oauthUrl?: string},
  {code: string; guildId: string; state: string}
>) {
  const handleOAuthCallback = useCallback(
    (data: OAuthCallbackData) => {
      advance({code: data.code, state: data.state, guildId: data.rest.guild_id ?? ''});
    },
    [advance]
  );

  return (
    <OAuthLoginStep
      oauthUrl={stepData?.oauthUrl}
      isLoading={isAdvancing}
      serviceName="Discord"
      onOAuthCallback={handleOAuthCallback}
      popup={{height: 900}}
    />
  );
}

export const discordIntegrationPipeline = {
  type: 'integration',
  provider: 'discord',
  actionTitle: t('Installing Discord Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing via Discord OAuth'),
      component: DiscordOAuthLoginStep,
    },
  ],
} as const satisfies PipelineDefinition;
