import {Fragment, useCallback, useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';

import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import {t} from 'sentry/locale';

import {useSeerOnboardingContext} from 'getsentry/views/seerAutomation/onboarding/hooks/seerOnboardingContext';
import {Steps} from 'getsentry/views/seerAutomation/onboarding/types';

import {ConfigureCodeReviewStep} from './configureCodeReviewStep';
import {ConfigureRootCauseAnalysisStep} from './configureRootCauseAnalysisStep';
import {ConnectGithubStep} from './connectGithubStep';
import {NextStepsStep} from './nextStepsStep';

export function StepsManager() {
  const {currentStep, setCurrentStep} = useGuidedStepsContext();

  const {provider, isProviderPending, installationData, isInstallationPending} =
    useSeerOnboardingContext();

  const handleStepChange = useCallback(
    (newStep: number) => {
      setCurrentStep(newStep);
    },
    [setCurrentStep]
  );

  useEffect(() => {
    // If we have *any* valid GitHub installations, we can skip to next step
    if (
      currentStep === 1 &&
      !isInstallationPending &&
      installationData?.find(installation => installation.provider.key === 'github')
    ) {
      handleStepChange(2);
    }
  }, [
    currentStep,
    isInstallationPending,
    installationData,
    handleStepChange,
    setCurrentStep,
  ]);

  if (!isInstallationPending && !isProviderPending && !provider) {
    Sentry.logger.error('Seer: No valid integration found for Seer onboarding');
    return <Alert type="error">{t('No supported SCM integrations are available')}</Alert>;
  }

  return (
    <Fragment>
      <GuidedSteps.Step stepKey={Steps.CONNECT_GITHUB} title={t('Connect GitHub')}>
        <ConnectGithubStep />
      </GuidedSteps.Step>

      <GuidedSteps.Step
        stepKey={Steps.SETUP_CODE_REVIEW}
        title={t('Set Up AI Code Review')}
      >
        <ConfigureCodeReviewStep />
      </GuidedSteps.Step>

      <GuidedSteps.Step
        stepKey={Steps.SETUP_ROOT_CAUSE_ANALYSIS}
        title={t('Set Up AI Root Cause Analysis')}
      >
        <ConfigureRootCauseAnalysisStep />
      </GuidedSteps.Step>

      <GuidedSteps.Step stepKey={Steps.NEXT_STEPS} title={t('Next Steps')}>
        <NextStepsStep />
      </GuidedSteps.Step>
    </Fragment>
  );
}
