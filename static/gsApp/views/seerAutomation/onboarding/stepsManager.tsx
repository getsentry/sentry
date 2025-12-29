import {Fragment} from 'react';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';

import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
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

  if (!isInstallationPending && !isProviderPending && !provider) {
    Sentry.logger.error('Seer: No valid integration found for Seer onboarding');
    return (
      <Alert type="danger">{t('No supported SCM integrations are available')}</Alert>
    );
  }

  return (
    <Fragment>
      <GuidedSteps.Step
        stepKey={String(Steps.CONNECT_GITHUB)}
        title={t('Connect GitHub')}
      >
        <ConnectGithubStep />
      </GuidedSteps.Step>

      <GuidedSteps.Step
        stepKey={String(Steps.SETUP_CODE_REVIEW)}
        title={t('Set Up AI Code Review')}
      >
        <ConfigureCodeReviewStep />
      </GuidedSteps.Step>

      <GuidedSteps.Step
        stepKey={String(Steps.SETUP_ROOT_CAUSE_ANALYSIS)}
        title={t('Set Up AI Root Cause Analysis')}
      >
        <ConfigureRootCauseAnalysisStep />
      </GuidedSteps.Step>

      <GuidedSteps.Step
        stepKey={String(Steps.SETUP_DEFAULTS)}
        title={t('Set Up Defaults')}
      >
        <ConfigureDefaultsStep />
      </GuidedSteps.Step>

      <GuidedSteps.Step stepKey={String(Steps.WRAP_UP)} title={t('Wrap Up')}>
        <WrapUpStep />
      </GuidedSteps.Step>
    </Fragment>
  );
}
