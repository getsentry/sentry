import {useCallback, useMemo, useState} from 'react';

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
  const [repositoryProjectMappings, setRepositoryProjectMappings] = useState<
    Record<string, string[]>
  >({});

  const handleNextStep = useCallback(() => {
    // TODO: Save to backend
    setCurrentStep(currentStep + 1);
  }, [setCurrentStep, currentStep]);

  const handleRepositoryProjectMappingsChange = useCallback(
    (newRepositoryProjectMappings: Record<string, string[]>) => {
      setRepositoryProjectMappings(newRepositoryProjectMappings);
    },
    [setRepositoryProjectMappings]
  );

  const isFinishDisabled = useMemo(() => {
    const mappings = Object.values(repositoryProjectMappings);
    return (
      !mappings.length ||
      mappings.length !== selectedRepositories.length ||
      Boolean(mappings.some(projects => projects.length === 0)) ||
      selectedRepositories.length === 0
    );
  }, [repositoryProjectMappings, selectedRepositories.length]);

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

            <RepositoryToProjectConfiguration
              repositories={selectedRepositories}
              onChange={handleRepositoryProjectMappingsChange}
            />
          </PanelBody>
        </MaxWidthPanel>
      </StepContent>

      <GuidedSteps.ButtonWrapper>
        <GuidedSteps.BackButton size="md" />
        <Button
          size="md"
          onClick={handleNextStep}
          priority={isFinishDisabled ? 'default' : 'primary'}
          disabled={isFinishDisabled}
          aria-label={t('Finish Setup')}
        >
          {t('Finish Setup')}
        </Button>
      </GuidedSteps.ButtonWrapper>
    </GuidedSteps.Step>
  );
}
