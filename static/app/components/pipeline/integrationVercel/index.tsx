import {useEffect, useRef} from 'react';

import {Text} from '@sentry/scraps/text';

import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

function VercelInstallStep({
  stepData,
  advance,
}: PipelineStepProps<{state: string}, {state: string}>) {
  // Vercel installs are initiated from the Vercel marketplace, which performs
  // the OAuth grant and forwards the `code` as initialData. By the time the
  // modal opens everything the pipeline needs is already bound to state, so we
  // advance immediately with no user interaction. The ref guards against React
  // strict mode double-firing the effect.
  const hasAutoAdvanced = useRef(false);
  useEffect(() => {
    if (!stepData?.state || hasAutoAdvanced.current) {
      return;
    }
    hasAutoAdvanced.current = true;
    advance({state: stepData.state});
  }, [stepData, advance]);

  return <Text>{t('Finishing up Vercel integration installation...')}</Text>;
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
      shortDescription: t('Finishing installation'),
      component: VercelInstallStep,
    },
  ],
} as const satisfies PipelineDefinition;
