import {Fragment} from 'react';
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
import {ConfigureDefaultsStep} from './configureDefaultsStep';
import {ConfigureRootCauseAnalysisStep} from './configureRootCauseAnalysisStep';
import {ConnectGithubStep} from './connectGithubStep';
import {WrapUpStep} from './wrapUpStep';

export function StepsManager() {
  const {provider, isProviderPending, isInstallationPending} = useSeerOnboardingContext();
  const {currentStep, setCurrentStep} = useGuidedStepsContext();

  if (!isInstallationPending && !isProviderPending && !provider) {
    Sentry.logger.error('Seer: No valid integration found for Seer onboarding');
    return (
      <Alert variant="danger">{t('No supported SCM integrations are available')}</Alert>
    );
  }

  return (
    <Fragment>
      <GuidedSteps.Step
        stepKey={String(Steps.CONNECT_GITHUB)}
        title={t('Connect GitHub')}
        onClick={() => setCurrentStep(Steps.CONNECT_GITHUB)}
      >
        <ConnectGithubStep />
      </GuidedSteps.Step>

      <GuidedSteps.Step
        stepKey={String(Steps.SETUP_CODE_REVIEW)}
        title={t('Set Up AI Code Review')}
        onClick={
          currentStep < Steps.SETUP_CODE_REVIEW
            ? undefined
            : () => setCurrentStep(Steps.SETUP_CODE_REVIEW)
        }
      >
        <ConfigureCodeReviewStep />
      </GuidedSteps.Step>

      <GuidedSteps.Step
        stepKey={String(Steps.SETUP_ROOT_CAUSE_ANALYSIS)}
        title={t('Set Up AI Root Cause Analysis')}
        onClick={
          currentStep < Steps.SETUP_ROOT_CAUSE_ANALYSIS
            ? undefined
            : () => setCurrentStep(Steps.SETUP_ROOT_CAUSE_ANALYSIS)
        }
      >
        <ConfigureRootCauseAnalysisStep />
      </GuidedSteps.Step>

      <GuidedSteps.Step
        stepKey={String(Steps.SETUP_DEFAULTS)}
        title={t('Set Up Defaults')}
        onClick={
          currentStep < Steps.SETUP_DEFAULTS
            ? undefined
            : () => setCurrentStep(Steps.SETUP_DEFAULTS)
        }
      >
        <ConfigureDefaultsStep />
      </GuidedSteps.Step>

      <GuidedSteps.Step
        stepKey={String(Steps.WRAP_UP)}
        title={t('Wrap Up')}
        onClick={
          currentStep < Steps.WRAP_UP ? undefined : () => setCurrentStep(Steps.WRAP_UP)
        }
      >
        <WrapUpStep />
      </GuidedSteps.Step>
    </Fragment>
  );
}
