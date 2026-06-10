import {useEffect, useRef} from 'react';

import {Text} from '@sentry/scraps/text';

import type {
  PipelineDefinition,
  PipelineStepProps,
} from 'sentry/components/pipeline/types';
import {pipelineComplete} from 'sentry/components/pipeline/utils';
import {t} from 'sentry/locale';
import type {IntegrationWithConfig} from 'sentry/types/integrations';

type MsTeamsStepData = {
  appDirectoryInstall: true;
  state: string;
};

function MsTeamsInstallStep({
  stepData,
  advance,
}: PipelineStepProps<MsTeamsStepData, {state: string}>) {
  // MS Teams installs are initiated from the Teams Marketplace, so by the time
  // the pipeline modal opens all the install data is already bound to pipeline
  // state. The backend signals this with `appDirectoryInstall` and we advance
  // immediately with no user interaction. The ref guards against React strict
  // mode double-firing the effect.
  const hasAutoAdvanced = useRef(false);
  useEffect(() => {
    if (!stepData?.appDirectoryInstall || hasAutoAdvanced.current) {
      return;
    }
    hasAutoAdvanced.current = true;
    advance({state: stepData.state});
  }, [stepData, advance]);

  return <Text>{t('Finishing up Microsoft Teams integration installation...')}</Text>;
}

export const msTeamsIntegrationPipeline = {
  type: 'integration',
  provider: 'msteams',
  actionTitle: t('Installing Microsoft Teams Integration'),
  getCompletionData: pipelineComplete<IntegrationWithConfig>,
  completionView: null,
  steps: [
    {
      stepId: 'msteams_install',
      shortDescription: t('Finishing installation'),
      component: MsTeamsInstallStep,
    },
  ],
} as const satisfies PipelineDefinition;
