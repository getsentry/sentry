import {useCallback} from 'react';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

import {useRedirectPopupStep} from './shared/useRedirectPopupStep';
import type {PipelineDefinition, PipelineStepProps} from './types';
import {pipelineComplete} from './types';

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

  const {reopenPopup, isWaitingForCallback} = useRedirectPopupStep({
    redirectUrl: stepData.authorizeUrl,
    autoOpen: false,
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
      </Stack>
      {isAdvancing ? (
        <Button size="sm" disabled>
          {t('Authorizing...')}
        </Button>
      ) : isWaitingForCallback ? (
        <Button size="sm" onClick={reopenPopup}>
          {t('Reopen authorization window')}
        </Button>
      ) : (
        <Button
          size="sm"
          priority="primary"
          onClick={reopenPopup}
          disabled={!stepData.authorizeUrl}
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
  steps: [
    {
      stepId: 'authorize',
      shortDescription: t('Authorizing Bitbucket'),
      component: BitbucketAuthorizeStep,
    },
  ],
} as const satisfies PipelineDefinition;
