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

import {
  Field,
  FieldDescription,
  FieldLabel,
  MaxWidthPanel,
  PanelDescription,
  PanelWithImage,
  StepContent,
} from './common';
import {RepositorySelector} from './repositorySelector';

export function ConfigureCodeReviewStep() {
  const organization = useOrganization();
  const {currentStep, setCurrentStep} = useGuidedStepsContext();

  const [enableCodeReview, setEnableCodeReview] = useState(
    organization.autoEnableCodeReview ?? true
  );

  const {mutate: updateOrganization} = useUpdateOrganization(organization);

  const handleNextStep = useCallback(() => {
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
    setCurrentStep,
    currentStep,
    enableCodeReview,
    organization.autoEnableCodeReview,
    updateOrganization,
  ]);

  return (
    <Fragment>
      <StepContent>
        <PanelWithImage gap="3xl">
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
                  {t(
                    'AI Code Review needs to be enabled in order to select repositories.'
                  )}
                </Alert>
              )}
              <RepositorySelector disabled={!enableCodeReview} />
            </PanelBody>
          </MaxWidthPanel>
          <Image src={configureCodeReviewImg} alt="Configure Code Review" />
        </PanelWithImage>

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
      </StepContent>
    </Fragment>
  );
}

const Image = styled('img')`
  height: 150px;
  width: 213px;
  margin-left: ${p => p.theme.space.xl};
  margin-top: ${p => p.theme.space['3xl']};
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;
