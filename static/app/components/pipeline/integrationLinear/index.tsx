import {useCallback, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Stack} from '@sentry/scraps/layout';

import {
  type OAuthCallbackData,
  OAuthLoginStep,
} from 'sentry/components/pipeline/shared/oauthLoginStep';
import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

function LinearOAuthLoginStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<{oauthUrl?: string}, {code: string; state: string}>) {
  const [authorizationCanceled, setAuthorizationCanceled] = useState(false);
  const handleOAuthCallback = useCallback(
    ({code, state, rest}: OAuthCallbackData) => {
      if (rest.error) {
        setAuthorizationCanceled(true);
        return;
      }
      setAuthorizationCanceled(false);
      advance({code, state});
    },
    [advance]
  );

  return (
    <Stack gap="lg">
      {authorizationCanceled && (
        <Alert variant="warning" role="alert">
          {t('Linear authorization was canceled. Authorize your workspace to try again.')}
        </Alert>
      )}
      <OAuthLoginStep
        oauthUrl={stepData?.oauthUrl}
        isLoading={isAdvancing}
        serviceName="Linear"
        onOAuthCallback={handleOAuthCallback}
        description={t(
          'Connect your Linear workspace so Seer can work with issues, projects, and comments for everyone in your organization. Sentry requests read and write access, which a Linear workspace admin must approve.'
        )}
      />
    </Stack>
  );
}

export const linearIntegrationPipeline = {
  type: 'integration',
  provider: 'linear',
  actionTitle: t('Installing Linear'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing Linear'),
      component: LinearOAuthLoginStep,
    },
  ],
} as const satisfies PipelineDefinition;
