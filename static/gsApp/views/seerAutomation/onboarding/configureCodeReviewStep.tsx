import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import {useSeerOnboardingContext} from 'getsentry/views/seerAutomation/onboarding/hooks/seerOnboardingContext';
import {useUpdateRepositorySettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useUpdateRepositorySettings';

import {
  Field,
  FieldDescription,
  FieldLabel,
  MaxWidthPanel,
  PanelDescription,
  StepContent,
} from './common';
import {RepositorySelector} from './repositorySelector';

const DEFAULT_CODE_REVIEW_TRIGGERS = [
  'on_command_phrase',
  'on_new_commit',
  'on_ready_for_review',
];

export function ConfigureCodeReviewStep() {
  const organization = useOrganization();
  const {currentStep, setCurrentStep} = useGuidedStepsContext();
  const {selectedCodeReviewRepositories, unselectedCodeReviewRepositories} =
    useSeerOnboardingContext();

  const [enableCodeReview, setEnableCodeReview] = useState(
    organization.autoEnableCodeReview ?? true
  );

  const {mutate: updateRepositorySettings, isPending: isUpdateRepositorySettingsPending} =
    useUpdateRepositorySettings();

  const handleNextStep = useCallback(() => {
    const updateEnabledCodeReview = () =>
      new Promise<void>((resolve, reject) => {
        if (!enableCodeReview) {
          // Nothing to do, just resolve
          resolve();
          return;
        }

        updateRepositorySettings(
          {
            codeReviewTriggers: DEFAULT_CODE_REVIEW_TRIGGERS,
            enabledCodeReview: enableCodeReview,
            repositoryIds: selectedCodeReviewRepositories.map(repo => repo.id),
          },
          {
            onSuccess: () => {
              resolve();
            },
            onError: () => {
              reject(new Error(t('Failed to enable AI Code Review')));
            },
          }
        );
      });

    // This handles the case where we load selected repositories from the server, but the user unselects some of them.
    // Note: this will also write the preference for repos that previously had no setting on the server, was selected, and then unselected.
    const updateUnselectedRepositories = () =>
      new Promise<void>((resolve, reject) => {
        if (unselectedCodeReviewRepositories.length === 0) {
          // Nothing to do, just resolve
          resolve();
          return;
        }

        updateRepositorySettings(
          {
            codeReviewTriggers: [],
            enabledCodeReview: false,
            repositoryIds: unselectedCodeReviewRepositories.map(repo => repo.id),
          },
          {
            onSuccess: () => {
              resolve();
            },
            onError: () => {
              reject(new Error(t('Failed to disable AI Code Review')));
            },
          }
        );
      });

    updateEnabledCodeReview();

    // Only the latest call to mutation will resolve, so we only check updateUnselectedRepositories
    // We will have another promise here, so leaving this Promise.all for now
    Promise.all([updateUnselectedRepositories()])
      .then(() => {
        setCurrentStep(currentStep + 1);
      })
      .catch(() => {
        addErrorMessage(
          t('Failed to update AI Code Review settings, reload and try again')
        );
      });
  }, [
    setCurrentStep,
    currentStep,
    enableCodeReview,
    updateRepositorySettings,
    selectedCodeReviewRepositories,
    unselectedCodeReviewRepositories,
  ]);

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
          <Flex direction="row" gap="xl" align="center">
            <Button
              size="md"
              disabled={isUpdateRepositorySettingsPending}
              onClick={handleNextStep}
              priority="primary"
              aria-label={t('Next Step')}
            >
              {t('Next Step')}
            </Button>
            {isUpdateRepositorySettingsPending && <InlineLoadingIndicator size={20} />}
          </Flex>
        </GuidedSteps.ButtonWrapper>
      </StepContent>
    </Fragment>
  );
}

const InlineLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
