import {useCallback, useEffect, useRef} from 'react';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {useRedirectPopupStep} from 'sentry/components/pipeline/shared/useRedirectPopupStep';
import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/types';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

interface InstallStepData {
  installUrl?: string;
  originInitiated?: boolean;
  state?: string;
}

interface InstallAdvanceData {
  state: string;
  installationReceipt?: string;
}

function CursorOriginInstallStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<InstallStepData, InstallAdvanceData>) {
  const handleCallback = useCallback(
    (data: Record<string, string>) => {
      if (data.installation_receipt && data.state) {
        advance({installationReceipt: data.installation_receipt, state: data.state});
      }
    },
    [advance]
  );

  const {openPopup, isWaitingForCallback, popupStatus} = useRedirectPopupStep({
    redirectUrl: stepData?.installUrl,
    onCallback: handleCallback,
  });

  // An install started from Origin's marketplace is already done by the time the
  // modal opens: the backend verified the receipt and bound the installation, so
  // there is nothing to ask the user for. The ref guards against React strict
  // mode double-firing the effect.
  const hasAutoAdvanced = useRef(false);
  useEffect(() => {
    if (!stepData?.originInitiated || !stepData.state || hasAutoAdvanced.current) {
      return;
    }
    hasAutoAdvanced.current = true;
    advance({state: stepData.state});
  }, [stepData, advance]);

  if (stepData?.originInitiated) {
    return <Text>{t('Finishing up your Cursor Origin installation...')}</Text>;
  }

  return (
    <Stack gap="lg" align="start">
      <Stack gap="sm">
        <Text>
          {t(
            'Choose the codebase and repositories Sentry can read, then approve the install in Cursor Origin.'
          )}
        </Text>
        {isWaitingForCallback && (
          <Text variant="muted" size="sm">
            {t(
              'Complete the installation in the popup window. This page will update automatically.'
            )}
          </Text>
        )}
        {popupStatus === 'failed-to-open' && (
          <Text variant="danger" size="sm">
            {t(
              'The installation popup was blocked by your browser. Please ensure popups are allowed and try again.'
            )}
          </Text>
        )}
      </Stack>
      {isWaitingForCallback && !isAdvancing ? (
        <Button size="sm" onClick={openPopup}>
          {t('Reopen installation window')}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="primary"
          onClick={openPopup}
          busy={isAdvancing}
          disabled={!stepData?.installUrl}
        >
          {t('Install on Origin')}
        </Button>
      )}
    </Stack>
  );
}

export const cursorOriginIntegrationPipeline = {
  type: 'integration',
  provider: 'cursor_origin',
  actionTitle: t('Installing Cursor Origin'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'install',
      shortDescription: t('Installing on Origin'),
      component: CursorOriginInstallStep,
    },
  ],
} as const satisfies PipelineDefinition;
