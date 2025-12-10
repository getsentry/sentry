import {Fragment, useCallback} from 'react';

import {Button} from '@sentry/scraps/button';

import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';

import {useSeerOnboardingContext} from './hooks/seerOnboardingContext';
import {MaxWidthPanel, PanelDescription, StepContent} from './common';
import {RepositorySelector} from './repositorySelector';

export function ConfigureCodeReviewStep() {
  const {selectedCodeReviewRepositories} = useSeerOnboardingContext();
  const {currentStep, setCurrentStep} = useGuidedStepsContext();

  const hasSelectedRepositories = selectedCodeReviewRepositories.length > 0;

  const handleNextStep = useCallback(() => {
    if (hasSelectedRepositories) {
      // TODO: Save to backend
      setCurrentStep(currentStep + 1);
    }
  }, [hasSelectedRepositories, setCurrentStep, currentStep]);

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

            <RepositorySelector />
          </PanelBody>
        </MaxWidthPanel>

        <GuidedSteps.ButtonWrapper>
          <Button
            size="md"
            onClick={handleNextStep}
            priority={hasSelectedRepositories ? 'primary' : 'default'}
            disabled={!hasSelectedRepositories}
            aria-label={t('Next Step')}
            title={
              hasSelectedRepositories
                ? undefined
                : t('Select repositories before continuing to the next step')
            }
          >
            {t('Next Step')}
          </Button>
        </GuidedSteps.ButtonWrapper>
      </StepContent>
    </Fragment>
  );
}
