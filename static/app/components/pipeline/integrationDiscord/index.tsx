import {useCallback, useEffect, useRef} from 'react';

import {Text} from '@sentry/scraps/text';

import type {OAuthCallbackData} from 'sentry/components/pipeline/shared/oauthLoginStep';
import {OAuthLoginStep} from 'sentry/components/pipeline/shared/oauthLoginStep';
import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/utils';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

type DiscordOAuthStepData =
  | {
      appDirectoryInstall: true;
      code: string;
      guildId: string;
      state: string;
    }
  | {
      appDirectoryInstall?: false;
      oauthUrl?: string;
    };

function DiscordOAuthLoginStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<
  DiscordOAuthStepData,
  {code: string; guildId: string; state: string}
>) {
  const handleOAuthCallback = useCallback(
    (data: OAuthCallbackData) => {
      advance({code: data.code, state: data.state, guildId: data.rest.guild_id ?? ''});
    },
    [advance]
  );

  // App Directory installs arrive with OAuth already complete. The backend
  // signals this by returning `appDirectoryInstall` in step data along with
  // the values to advance with — no popup, no user interaction.
  const hasAutoAdvanced = useRef(false);
  useEffect(() => {
    if (!stepData?.appDirectoryInstall || hasAutoAdvanced.current) {
      return;
    }
    hasAutoAdvanced.current = true;
    advance({
      code: stepData.code,
      guildId: stepData.guildId,
      state: stepData.state,
    });
  }, [stepData, advance]);

  if (stepData?.appDirectoryInstall) {
    return <Text>{t('Finishing up Discord integration installation...')}</Text>;
  }

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
