import {Fragment, useCallback} from 'react';
import styled from '@emotion/styled';

import configureCodeReviewImg from 'sentry-images/spot/seer-config-check.svg';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Separator} from '@sentry/scraps/separator';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import {DEFAULT_CODE_REVIEW_TRIGGERS} from 'sentry/types/integrations';
import useOrganization from 'sentry/utils/useOrganization';

import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {useSeerOnboardingContext} from 'getsentry/views/seerAutomation/onboarding/hooks/seerOnboardingContext';
import {useBulkUpdateRepositorySettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useBulkUpdateRepositorySettings';

import {MaxWidthPanel, PanelDescription, StepContent} from './common';
import {RepositorySelector} from './repositorySelector';

// This is the max # of repos that we will allow to be pre-selected.
const MAX_REPOSITORIES_TO_PRESELECT = 10;

export function ConfigureCodeReviewStep() {
  const organization = useOrganization();
  const {currentStep, setCurrentStep} = useGuidedStepsContext();
  const {
    clearRootCauseAnalysisRepositories,
    selectedCodeReviewRepositories,
    unselectedCodeReviewRepositories,
  } = useSeerOnboardingContext();

  const {mutate: updateRepositorySettings, isPending: isUpdateRepositorySettingsPending} =
    useBulkUpdateRepositorySettings();

  const handleNextStep = useCallback(() => {
    const existingRepostoriesToRemove = unselectedCodeReviewRepositories
      .filter(repo => repo.settings?.enabledCodeReview)
      .map(repo => repo.id);

    const hasSelectedRepositories = selectedCodeReviewRepositories.length > 0;
    const hasUnselectedRepositories = existingRepostoriesToRemove.length > 0;

    // Turn on code review for the selected repositories.
    const updateEnabledCodeReview = () =>
      new Promise<void>((resolve, reject) => {
        if (!hasSelectedRepositories) {
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
        if (!hasUnselectedRepositories) {
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

        if (hasSelectedRepositories || hasUnselectedRepositories) {
          addSuccessMessage(t('AI Code Review settings updated successfully'));

          trackGetsentryAnalytics('seer.onboarding.code_review_updated', {
            organization,
            added_repositories: selectedCodeReviewRepositories.length,
            removed_repositories: existingRepostoriesToRemove.length,
          });
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
    currentStep,
    setCurrentStep,
    updateRepositorySettings,
    organization,
  ]);

  return (
    <Fragment>
      <StepContentWithBackground>
        <MaxWidthPanel>
          <PanelBody>
            <PanelDescription>
              <Flex direction="column" gap="lg">
                <Text>{t(`You've successfully connected to GitHub!`)}</Text>
                <Separator orientation="horizontal" border="muted" />

                <Flex direction="column" gap="sm">
                  <Text bold>{t('AI Code Review')}</Text>
                  <Text variant="muted">
                    {t(
                      `For all selected repositories below, Seer's AI Code Review will be run to review your PRs and flag potential bugs. `
                    )}
                  </Text>
                </Flex>
              </Flex>
            </PanelDescription>
            <RepositorySelector />
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
