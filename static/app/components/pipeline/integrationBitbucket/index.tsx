import {useCallback} from 'react';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useRedirectPopupStep} from 'sentry/components/pipeline/shared/useRedirectPopupStep';
import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/utils';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

interface AuthorizeStepData {
  authorizeUrl?: string;
}

interface AuthorizeAdvanceData {
  jwt: string;
}

function BitbucketAuthorizeStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<AuthorizeStepData, AuthorizeAdvanceData>) {
  const handleCallback = useCallback(
    (data: Record<string, string>) => {
      if (data.jwt) {
        advance({jwt: data.jwt});
      }
    },
    [advance]
  );

  const {openPopup, isWaitingForCallback, popupStatus} = useRedirectPopupStep({
    redirectUrl: stepData?.authorizeUrl,
    onCallback: handleCallback,
  });

  return (
    <Stack gap="lg" align="start">
      <Stack gap="sm">
        <Text>
          {t(
            'Connect your Bitbucket account by authorizing the Sentry add-on for Bitbucket.'
          )}
        </Text>
        {isWaitingForCallback && (
          <Text variant="muted" size="sm">
            {t('A popup should have opened to authorize with Bitbucket.')}
          </Text>
        )}
        {popupStatus === 'failed-to-open' && (
          <Text variant="danger" size="sm">
            {t(
              'The authorization popup was blocked by your browser. Please ensure popups are allowed and try again.'
            )}
          </Text>
        )}
      </Stack>
      {isWaitingForCallback && !isAdvancing ? (
        <Button size="sm" onClick={openPopup}>
          {t('Reopen authorization window')}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="primary"
          onClick={openPopup}
          busy={isAdvancing}
          disabled={!stepData?.authorizeUrl}
        >
          {t('Authorize Bitbucket')}
        </Button>
      )}
    </Stack>
  );
}

export const bitbucketIntegrationPipeline = {
  type: 'integration',
  provider: 'bitbucket',
  actionTitle: t('Installing Bitbucket Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'authorize',
      shortDescription: t('Authorizing Bitbucket'),
      component: BitbucketAuthorizeStep,
    },
  ],
} as const satisfies PipelineDefinition;
