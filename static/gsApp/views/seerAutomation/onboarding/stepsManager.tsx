import {Fragment, useEffect} from 'react';
import * as Sentry from '@sentry/react';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';

import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import useOrganization from 'sentry/utils/useOrganization';

import {useSeerOnboardingContext} from 'getsentry/views/seerAutomation/onboarding/hooks/seerOnboardingContext';
import {Steps} from 'getsentry/views/seerAutomation/onboarding/types';

import {ConfigureCodeReviewStep} from './configureCodeReviewStep';
import {ConfigureDefaultsStep} from './configureDefaultsStep';
import {ConfigureRootCauseAnalysisStep} from './configureRootCauseAnalysisStep';
import {ConnectGithubStep} from './connectGithubStep';
import {NextStepsStep} from './nextStepsStep';

interface OnboardingStatus {
  hasSupportedScmIntegration: boolean;
  isAutofixEnabled: boolean;
  isCodeReviewEnabled: boolean;
  isSeerConfigured: boolean;
}

function useOnboardingStatus() {
  const {setCurrentStep} = useGuidedStepsContext();
  const organization = useOrganization();
  const statusQuery = useQuery({
    ...apiOptions.as<OnboardingStatus>()(
      '/organizations/$organizationIdOrSlug/seer/onboarding-check/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
        },
        staleTime: 60_000,
      }
    ),
  });

  useEffect(() => {
    if (!statusQuery.isPending && statusQuery.data) {
      let nextStep = 1;
      const {hasSupportedScmIntegration, isCodeReviewEnabled, isAutofixEnabled} =
        statusQuery.data;

      if (!hasSupportedScmIntegration) {
        return;
      }

      if (!isCodeReviewEnabled) {
        nextStep = 2;
      }
      if (isCodeReviewEnabled && !isAutofixEnabled) {
        nextStep = 3;
      }
      if (isCodeReviewEnabled && isAutofixEnabled) {
        nextStep = 4;
      }

      setCurrentStep(nextStep);
    }
  }, [statusQuery.isPending, statusQuery.data, setCurrentStep]);

  return statusQuery;
}

export function StepsManager() {
  const {provider, isProviderPending, isInstallationPending} = useSeerOnboardingContext();
  useOnboardingStatus();

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

      <GuidedSteps.Step stepKey={Steps.SETUP_DEFAULTS} title={t('Set Up Defaults')}>
        <ConfigureDefaultsStep />
      </GuidedSteps.Step>

      <GuidedSteps.Step stepKey={Steps.NEXT_STEPS} title={t('Wrap Up')}>
        <NextStepsStep />
      </GuidedSteps.Step>
    </Fragment>
  );
}
