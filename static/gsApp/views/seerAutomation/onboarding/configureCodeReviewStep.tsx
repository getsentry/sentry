import {Fragment, useCallback, useState} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';

import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import {useSeerOnboardingContext} from './hooks/seerOnboardingContext';
import {
  Field,
  FieldDescription,
  FieldLabel,
  MaxWidthPanel,
  PanelDescription,
  StepContent,
} from './common';
import {RepositorySelector} from './repositorySelector';

export function ConfigureCodeReviewStep() {
  const organization = useOrganization();
  const {selectedCodeReviewRepositories} = useSeerOnboardingContext();
  const {currentStep, setCurrentStep} = useGuidedStepsContext();

  const [enableCodeReview, setEnableCodeReview] = useState(
    organization.autoEnableCodeReview
  );
  const hasSelectedRepositories = selectedCodeReviewRepositories.length > 0;
  const canAdvance = !enableCodeReview || hasSelectedRepositories;

  const handleNextStep = useCallback(() => {
    if (canAdvance) {
      // TODO: Save to backend

      // ensure if enableCodeReview is false, we don't save hasSelectedRepositories
      setCurrentStep(currentStep + 1);
    }
  }, [canAdvance, setCurrentStep, currentStep]);

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

            <Field>
              <Flex direction="column" flex="1" gap="xs">
                <FieldLabel>{t('AI Code Review')}</FieldLabel>
                <FieldDescription>
                  {t(
                    'For all repos below, AND for all newly connected repos, Seer will review your PRs and flag potential bugs. '
                  )}
                </FieldDescription>
              </Flex>
              <Switch
                size="lg"
                checked={enableCodeReview}
                onChange={() => setEnableCodeReview(!enableCodeReview)}
              />
            </Field>
            {enableCodeReview ? null : (
              <Alert type="info">
                {t('AI Code Review needs to be enabled in order to select repositories.')}
              </Alert>
            )}
            <RepositorySelector disabled={!enableCodeReview} />
          </PanelBody>
        </MaxWidthPanel>

        <GuidedSteps.ButtonWrapper>
          <Button
            size="md"
            onClick={handleNextStep}
            priority={canAdvance ? 'primary' : 'default'}
            disabled={!canAdvance}
            aria-label={t('Next Step')}
            title={
              canAdvance
                ? undefined
                : t(
                    'Enable AI Code Review and select repositories before continuing to the next step'
                  )
            }
          >
            {t('Next Step')}
          </Button>
        </GuidedSteps.ButtonWrapper>
      </StepContent>
    </Fragment>
  );
}
