import {useCallback, useMemo} from 'react';

import {Button} from '@sentry/scraps/button';

import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import type {IntegrationProvider, Repository} from 'sentry/types/integrations';

import {MaxWidthPanel, PanelDescription, StepContent} from './common';
import {RepositorySelector} from './repositorySelector';
import {Steps} from './types';

interface ConfigureCodeReviewStepProps {
  isFetching: boolean;
  onRepositorySelectionChange: (newSelections: Record<string, boolean>) => void;
  provider: IntegrationProvider | undefined;
  repositories: Repository[];
  selectedRepositoriesMap: Record<string, boolean>;
}
export function ConfigureCodeReviewStep({
  provider,
  repositories,
  isFetching,
  selectedRepositoriesMap,
  onRepositorySelectionChange,
}: ConfigureCodeReviewStepProps) {
  const {currentStep, setCurrentStep} = useGuidedStepsContext();
  const selectedRepositories = useMemo(() => {
    return Object.entries(selectedRepositoriesMap)
      .filter(([_, isSelected]) => isSelected)
      .map(([repoId]) => repositories.find(repo => repo.id === repoId))
      .filter(Boolean);
  }, [selectedRepositoriesMap, repositories]);

  const handleNextStep = useCallback(() => {
    if (selectedRepositories.length > 0) {
      // TODO: Save to backend
      setCurrentStep(currentStep + 1);
    }
  }, [selectedRepositories.length, setCurrentStep, currentStep]);

  return (
    <GuidedSteps.Step
      stepKey={Steps.SETUP_CODE_REVIEW}
      title={t('Set Up AI Code Review')}
    >
      <StepContent>
        <MaxWidthPanel>
          <PanelBody>
            <PanelDescription>
              <p>{t(`You successfully connected to GitHub!`)}</p>

              <p>
                {t(`
Now, select which of your repositories you would like to run Seer’s AI Code Review on.
`)}
              </p>
            </PanelDescription>
            <RepositorySelector
              provider={provider}
              repositories={repositories}
              isFetching={isFetching}
              selectedRepositories={selectedRepositoriesMap}
              onSelectionChange={onRepositorySelectionChange}
            />
          </PanelBody>
        </MaxWidthPanel>

        <GuidedSteps.ButtonWrapper>
          <Button
            size="md"
            onClick={handleNextStep}
            priority={selectedRepositories.length > 0 ? 'primary' : 'default'}
            disabled={selectedRepositories.length === 0}
            aria-label={t('Next Step')}
            title={
              selectedRepositories.length === 0
                ? t('Select repositories before continuing to the next step')
                : undefined
            }
          >
            {t('Next Step')}
          </Button>
        </GuidedSteps.ButtonWrapper>
      </StepContent>
    </GuidedSteps.Step>
  );
}
