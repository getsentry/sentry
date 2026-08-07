import {useEffect, useRef} from 'react';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {t, tct} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

interface VercelConfirmStepData {
  account: string;
  accountType: string;
  organization: string;
  state: string;
}

function VercelOAuthStep({
  stepData,
  advance,
}: PipelineStepProps<{state: string}, {state: string}>) {
  // Vercel installs are initiated from the Vercel marketplace, which performs
  // the OAuth grant and forwards the `code` as initialData. Exchanging it
  // creates nothing in Sentry, so we advance immediately and let the following
  // step confirm the resulting account. The ref guards against React strict
  // mode double-firing the effect.
  const hasAutoAdvanced = useRef(false);
  useEffect(() => {
    if (!stepData?.state || hasAutoAdvanced.current) {
      return;
    }
    hasAutoAdvanced.current = true;
    advance({state: stepData.state});
  }, [stepData, advance]);

  return <Text>{t('Connecting to Vercel...')}</Text>;
}

function VercelConfirmInstallStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<VercelConfirmStepData, {state: string}>) {
  // We do NOT auto-advance: a copied install link could connect an attacker's
  // Vercel account to a victim's org, so we surface the account and
  // organization and require an explicit confirmation before installing.
  return (
    <Stack gap="lg" align="start">
      <Heading as="h3">{t('Connect Vercel to Sentry')}</Heading>

      <Text>
        {tct(
          'You are about to connect a Vercel account to the [organization] Sentry organization. Deploys from this account will be able to create releases in the organization.',
          {
            organization: (
              <Text as="span" bold>
                {stepData?.organization}
              </Text>
            ),
          }
        )}
      </Text>

      {stepData?.account && (
        <Text>
          {stepData.accountType === 'team' ? t('Vercel team:') : t('Vercel account:')}{' '}
          <Text as="span" bold>
            {stepData.account}
          </Text>
        </Text>
      )}

      <Text variant="warning">
        {t(
          'If you did not start this installation yourself, do not continue. The link may have been sent to you by someone else.'
        )}
      </Text>

      <Button
        variant="primary"
        busy={isAdvancing}
        disabled={!stepData}
        onClick={() => stepData && advance({state: stepData.state})}
      >
        {t('Install Vercel integration')}
      </Button>
    </Stack>
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
      shortDescription: t('Connecting to Vercel'),
      component: VercelOAuthStep,
    },
    {
      stepId: 'vercel_confirm_install',
      shortDescription: t('Confirming installation'),
      component: VercelConfirmInstallStep,
    },
  ],
} as const satisfies PipelineDefinition;
