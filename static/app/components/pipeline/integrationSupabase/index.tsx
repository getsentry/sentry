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

function SupabaseOAuthLoginStep({
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
          {t(
            'Supabase authorization was canceled. Authorize your organization to try again.'
          )}
        </Alert>
      )}
      <OAuthLoginStep
        oauthUrl={stepData?.oauthUrl}
        isLoading={isAdvancing}
        serviceName="Supabase"
        onOAuthCallback={handleOAuthCallback}
        description={t(
          'Connect your Supabase organization so Seer can read project logs and current infrastructure and database metrics. Sentry requests read-only access, which a Supabase organization owner must authorize. This connection is shared with your Sentry organization.'
        )}
      />
    </Stack>
  );
}

export const supabaseIntegrationPipeline = {
  type: 'integration',
  provider: 'supabase',
  actionTitle: t('Installing Supabase'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'oauth_login',
      shortDescription: t('Authorizing Supabase'),
      component: SupabaseOAuthLoginStep,
    },
  ],
} as const satisfies PipelineDefinition;
