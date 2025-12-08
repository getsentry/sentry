import {Fragment, useCallback} from 'react';

import {Button} from '@sentry/scraps/button';

import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';

import {useSeerOnboardingContext} from 'getsentry/views/seerAutomation/onboarding/hooks/seerOnboardingContext';

import {MaxWidthPanel, PanelDescription, StepContent} from './common';
import {RepositorySelector} from './repositorySelector';

export function ConfigureCodeReviewStep() {
  const {
    provider,
    repositories,
    isRepositoriesFetching,
    selectedCodeReviewRepositories,
    setCodeReviewRepositories,
    selectedCodeReviewRepositoriesMap,
  } = useSeerOnboardingContext();
  const {currentStep, setCurrentStep} = useGuidedStepsContext();

  const handleNextStep = useCallback(() => {
    if (selectedCodeReviewRepositories.length > 0) {
      // TODO: Save to backend
      setCurrentStep(currentStep + 1);
    }
  }, [selectedCodeReviewRepositories.length, setCurrentStep, currentStep]);

  return (
    <Fragment>
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
              isFetching={isRepositoriesFetching}
              selectedRepositories={selectedCodeReviewRepositoriesMap}
              onSelectionChange={setCodeReviewRepositories}
            />
          </PanelBody>
        </MaxWidthPanel>

        <GuidedSteps.ButtonWrapper>
          <Button
            size="md"
            onClick={handleNextStep}
            priority={selectedCodeReviewRepositories.length > 0 ? 'primary' : 'default'}
            disabled={selectedCodeReviewRepositories.length === 0}
            aria-label={t('Next Step')}
            title={
              selectedCodeReviewRepositories.length === 0
                ? t('Select repositories before continuing to the next step')
                : undefined
            }
          >
            {t('Next Step')}
          </Button>
        </GuidedSteps.ButtonWrapper>
      </StepContent>
    </Fragment>
  );
}
