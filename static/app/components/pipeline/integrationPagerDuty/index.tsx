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

function PagerDutyInstallStep({
  stepData,
  advance,
  isAdvancing,
}: PipelineStepProps<{installUrl?: string}, {config: string}>) {
  const handleCallback = useCallback(
    (data: Record<string, string>) => {
      advance({config: data.config ?? ''});
    },
    [advance]
  );

  const {openPopup, popupStatus} = useRedirectPopupStep({
    redirectUrl: stepData?.installUrl,
    onCallback: handleCallback,
    popup: {height: 900},
  });

  return (
    <Stack gap="lg" align="start">
      <Stack gap="sm">
        <Text>
          {t(
            'Install the Sentry app on your PagerDuty account to complete the integration setup.'
          )}
        </Text>
        {popupStatus === 'popup-open' && (
          <Text variant="muted" size="sm">
            {t('A popup should have opened to install the PagerDuty app.')}
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
      {popupStatus === 'popup-open' && !isAdvancing ? (
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
          {t('Install PagerDuty App')}
        </Button>
      )}
    </Stack>
  );
}

export const pagerDutyIntegrationPipeline = {
  type: 'integration',
  provider: 'pagerduty',
  actionTitle: t('Installing PagerDuty Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'installation_redirect',
      shortDescription: t('Installing PagerDuty app'),
      component: PagerDutyInstallStep,
    },
  ],
} as const satisfies PipelineDefinition;
