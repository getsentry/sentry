import {useCallback} from 'react';

import {Button} from '@sentry/scraps/button';

import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';

import {MaxWidthPanel, PanelDescription, StepContent} from './common';
import {RepositoryToProjectConfiguration} from './repositoryToProjectConfiguration';
import {Steps} from './types';

interface ConfigureRootCauseAnalysisStepProps {
  selectedRepositories: Repository[];
}

export function ConfigureRootCauseAnalysisStep({
  selectedRepositories,
}: ConfigureRootCauseAnalysisStepProps) {
  const {currentStep, setCurrentStep} = useGuidedStepsContext();

  const handleNextStep = useCallback(() => {
    // TODO: Save to backend
    setCurrentStep(currentStep + 1);
  }, [setCurrentStep, currentStep]);

  return (
    <GuidedSteps.Step
      stepKey={Steps.SETUP_ROOT_CAUSE_ANALYSIS}
      title={t('Set Up AI Root Cause Analysis')}
    >
      <StepContent>
        <MaxWidthPanel>
          <PanelBody>
            <PanelDescription>
              <p>
                {t(
                  'Pair your projects with your repositories to enable Seer to analyze your codebase.'
                )}
              </p>
            </PanelDescription>

            <RepositoryToProjectConfiguration repositories={selectedRepositories} />
          </PanelBody>
        </MaxWidthPanel>
      </StepContent>

      <GuidedSteps.ButtonWrapper>
        <GuidedSteps.BackButton size="md" />
        <Button
          size="md"
          onClick={handleNextStep}
          priority={selectedRepositories.length > 0 ? 'primary' : 'default'}
          disabled={selectedRepositories.length === 0}
          aria-label={t('Finish Setup')}
        >
          {t('Finish Setup')}
        </Button>
      </GuidedSteps.ButtonWrapper>
    </GuidedSteps.Step>
  );
}
