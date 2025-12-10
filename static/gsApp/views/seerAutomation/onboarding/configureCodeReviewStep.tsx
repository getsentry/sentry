import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import configureCodeReviewImg from 'sentry-images/spot/seer-config-check.svg';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {useUpdateOrganization} from 'sentry/utils/useUpdateOrganization';

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

// This is the max # of repos that we will allow to be pre-selected.
const MAX_REPOSITORIES_TO_PRESELECT = 10;

export function ConfigureCodeReviewStep() {
  const organization = useOrganization();
  const {currentStep, setCurrentStep} = useGuidedStepsContext();
  const {clearRootCauseAnalysisRepositories, selectedCodeReviewRepositories} =
    useSeerOnboardingContext();
  const [enableCodeReview, setEnableCodeReview] = useState(
    organization.autoEnableCodeReview ?? true
  );

  const {mutate: updateOrganization} = useUpdateOrganization(organization);

  const handleNextStep = useCallback(() => {
    if (selectedCodeReviewRepositories.length > MAX_REPOSITORIES_TO_PRESELECT) {
      // When this happens, we clear the pre-populated repositories. Otherwise,
      // the user will have an overwhelming number of repositories to map.
      clearRootCauseAnalysisRepositories();
    }

    if (enableCodeReview === organization.autoEnableCodeReview) {
      // No update needed, proceed to next step
      setCurrentStep(currentStep + 1);
    } else {
      updateOrganization(
        {
          autoEnableCodeReview: enableCodeReview,
        },
        {
          onSuccess: () => {
            // TODO: Save selectedCodeReviewRepositories to backend
            setCurrentStep(currentStep + 1);
          },
          onError: () => {
            addErrorMessage(t('Failed to enable AI Code Review'));
          },
        }
      );
    }
  }, [
    clearRootCauseAnalysisRepositories,
    selectedCodeReviewRepositories.length,
    setCurrentStep,
    currentStep,
    enableCodeReview,
    organization.autoEnableCodeReview,
    updateOrganization,
  ]);

  return (
    <Fragment>
      <StepContentWithBackground>
        <MaxWidthPanel>
          <PanelBody>
            <PanelDescription>
              <p>{t(`You've successfully connected to GitHub!`)}</p>

              <p>
                {t(
                  `Now, select which repositories you would like to run Seer’s AI Code Review on.`
                )}
              </p>
            </PanelDescription>

            <Field>
              <Flex direction="column" flex="1" gap="xs">
                <FieldLabel>{t('AI Code Review')}</FieldLabel>
                <FieldDescription>
                  {t(
                    'For all repos below, AND for all newly connected repos, Seer will review your PRs and flag potential bugs.'
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
            priority="primary"
            aria-label={t('Next Step')}
          >
            {t('Next Step')}
          </Button>
        </GuidedSteps.ButtonWrapper>
      </StepContentWithBackground>
    </Fragment>
  );
}

const StepContentWithBackground = styled(StepContent)`
  background: url(${configureCodeReviewImg}) no-repeat 638px 0;
  background-size: 213px 150px;
`;
