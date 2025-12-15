import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import configureCodeReviewImg from 'sentry-images/spot/seer-config-check.svg';

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
import {useUpdateOrganization} from 'sentry/utils/useUpdateOrganization';

import {useSeerOnboardingContext} from 'getsentry/views/seerAutomation/onboarding/hooks/seerOnboardingContext';
import {useBulkUpdateRepositorySettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useBulkUpdateRepositorySettings';

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
const DEFAULT_CODE_REVIEW_TRIGGERS = [
  'on_command_phrase',
  'on_new_commit',
  'on_ready_for_review',
];

export function ConfigureCodeReviewStep() {
  const organization = useOrganization();
  const {currentStep, setCurrentStep} = useGuidedStepsContext();
  const {
    clearRootCauseAnalysisRepositories,
    selectedCodeReviewRepositories,
    unselectedCodeReviewRepositories,
  } = useSeerOnboardingContext();

  const [enableCodeReview, setEnableCodeReview] = useState(
    organization.autoEnableCodeReview ?? true
  );

  const {mutate: updateOrganization, isPending: isUpdateOrganizationPending} =
    useUpdateOrganization(organization);

  const {mutate: updateRepositorySettings, isPending: isUpdateRepositorySettingsPending} =
    useBulkUpdateRepositorySettings();

  const handleNextStep = useCallback(() => {
    const existingRepostoriesToRemove = unselectedCodeReviewRepositories
      .filter(repo => repo.settings?.enabledCodeReview)
      .map(repo => repo.id);

    const updateOrganizationEnabledCodeReview = () =>
      new Promise<void>((resolve, reject) => {
        if (enableCodeReview === organization.autoEnableCodeReview) {
          // No update needed, just resolve
          resolve();
          return;
        }

        updateOrganization(
          {
            autoEnableCodeReview: enableCodeReview,
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

    // Turn on code review for the selected repositories.
    const updateEnabledCodeReview = () =>
      new Promise<void>((resolve, reject) => {
        if (selectedCodeReviewRepositories.length === 0) {
          resolve();
          return;
        }

        updateRepositorySettings(
          {
            codeReviewTriggers: DEFAULT_CODE_REVIEW_TRIGGERS,
            enabledCodeReview: true,
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
    const updateUnselectedRepositories = () =>
      new Promise<void>((resolve, reject) => {
        if (existingRepostoriesToRemove.length === 0) {
          resolve();
          return;
        }

        updateRepositorySettings(
          {
            codeReviewTriggers: [],
            enabledCodeReview: false,
            repositoryIds: existingRepostoriesToRemove,
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

    const promises = [
      updateOrganizationEnabledCodeReview(),
      // This is intentionally serial bc they both mutate the same resource (the organization)
      // And react-query will only resolve the latest mutation
      updateEnabledCodeReview().then(() => updateUnselectedRepositories()),
    ];

    Promise.all(promises)
      .then(() => {
        if (selectedCodeReviewRepositories.length > MAX_REPOSITORIES_TO_PRESELECT) {
          // When this happens, we clear the pre-populated repositories. Otherwise,
          // the user will have an overwhelming number of repositories to map.
          clearRootCauseAnalysisRepositories();
        }
        setCurrentStep(currentStep + 1);
      })
      .catch(() => {
        addErrorMessage(
          t('Failed to update AI Code Review settings, reload and try again')
        );
      });
  }, [
    clearRootCauseAnalysisRepositories,
    selectedCodeReviewRepositories,
    unselectedCodeReviewRepositories,
    enableCodeReview,
    organization.autoEnableCodeReview,
    currentStep,
    setCurrentStep,
    updateOrganization,
    updateRepositorySettings,
  ]);

  const handleChangeCodeReview = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setEnableCodeReview(e.target.checked);
    },
    [setEnableCodeReview]
  );

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
                <FieldLabel>{t('Enable AI Code Review')}</FieldLabel>
                <FieldDescription>
                  <p>
                    {t(
                      'For all new repositories, Seer will review your PRs and flag potential bugs. '
                    )}
                  </p>
                </FieldDescription>
              </Flex>
              <Switch
                size="lg"
                checked={enableCodeReview}
                onChange={handleChangeCodeReview}
              />
            </Field>
            <RepositorySelector />
          </PanelBody>
        </MaxWidthPanel>

        <GuidedSteps.ButtonWrapper>
          <Flex direction="row" gap="xl" align="center">
            <Button
              size="md"
              disabled={isUpdateRepositorySettingsPending || isUpdateOrganizationPending}
              onClick={handleNextStep}
              priority="primary"
              aria-label={t('Next Step')}
            >
              {t('Next Step')}
            </Button>
            {(isUpdateRepositorySettingsPending || isUpdateOrganizationPending) && (
              <InlineLoadingIndicator size={20} />
            )}
          </Flex>
        </GuidedSteps.ButtonWrapper>
      </StepContentWithBackground>
    </Fragment>
  );
}

const StepContentWithBackground = styled(StepContent)`
  background: url(${configureCodeReviewImg}) no-repeat 638px 0;
  background-size: 213px 150px;
`;

const InlineLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
