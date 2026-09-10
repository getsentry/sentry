import {useCallback} from 'react';

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
}

interface InstallAdvanceData {
  state: string;
  installation_id?: string;
  installation_receipt?: string;
}

/**
 * Cursor Origin installs in a single step.
 *
 * Origin's install redirect returns a signed installation receipt directly, so
 * unlike GitHub there is no separate OAuth login leg and no organization
 * selection — one popup and the pipeline is done.
 */
function InstallStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<InstallStepData, InstallAdvanceData>) {
  const handleCallback = useCallback(
    (data: Record<string, string>) => {
      // `state` is always present on a well-formed callback, since we put it
      // there. Passing an empty string through when it is missing lets the
      // backend reject it with a real "invalid state" message rather than
      // having the step silently do nothing.
      advance({
        state: data.state ?? '',
        installation_receipt: data.installation_receipt,
        installation_id: data.installation_id,
      });
    },
    [advance]
  );

  const {openPopup, isWaitingForCallback, popupStatus} = useRedirectPopupStep({
    redirectUrl: stepData?.installUrl,
    onCallback: handleCallback,
  });

  if (stepData === null) {
    return null;
  }

  if (isWaitingForCallback || isAdvancing) {
    return (
      <Stack gap="lg" align="start">
        <Text>
          {t(
            'Complete the installation in the popup window. Once finished, this page will update automatically.'
          )}
        </Text>
        <Button size="sm" onClick={openPopup} busy={isAdvancing}>
          {t('Reopen installation window')}
        </Button>
      </Stack>
    );
  }

  return (
    <Stack gap="lg" align="start">
      <Text>
        {t(
          'Install the Sentry app on your Cursor Origin codebase to connect your repositories.'
        )}
      </Text>
      {popupStatus === 'failed-to-open' && (
        <Text variant="danger" size="sm">
          {t(
            'The installation popup was blocked by your browser. Please ensure popups are allowed and try again.'
          )}
        </Text>
      )}
      <Button
        size="sm"
        variant="primary"
        onClick={openPopup}
        disabled={!stepData.installUrl}
      >
        {t('Install Cursor Origin App')}
      </Button>
    </Stack>
  );
}

export const cursorOriginIntegrationPipeline = {
  type: 'integration',
  provider: 'cursor_origin',
  actionTitle: t('Installing Cursor Origin Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'install',
      shortDescription: t('Installing Cursor Origin Application'),
      component: InstallStep,
    },
  ],
} as const satisfies PipelineDefinition;
