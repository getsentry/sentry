import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import * as Sentry from '@sentry/react';

import {Alert} from '@sentry/scraps/alert';

import {useOrganizationRepositories} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import {useGuidedStepsContext} from 'sentry/components/guidedSteps/guidedSteps';
import {t} from 'sentry/locale';

import {useIntegrationInstallation} from './hooks/useIntegrationInstallation';
import useIntegrationProvider from './hooks/useIntegrationProvider';
import {ConfigureCodeReviewStep} from './configureCodeReviewStep';
import {ConfigureRootCauseAnalysisStep} from './configureRootCauseAnalysisStep';
import {ConnectGithubStep} from './connectGithubStep';
import {NextStepsStep} from './nextStepsStep';

export function StepsManager() {
  const [selectedRepositoriesMap, setSelectedRepositories] = useState<
    Record<string, boolean>
  >({});
  const {data: repositories, isFetching} = useOrganizationRepositories();
  const {data: installationData, isPending: isInstallationPending} =
    useIntegrationInstallation('github');
  const {provider, isPending: isProviderPending} = useIntegrationProvider('github');
  const {currentStep, setCurrentStep} = useGuidedStepsContext();

  const handleRepositorySelectionChange = useCallback(
    (newSelections: Record<string, boolean>) => {
      setSelectedRepositories(prev => ({...prev, ...newSelections}));
    },
    [setSelectedRepositories]
  );

  // Create map for lookup for `selectedRepositories`
  const repositoriesMap = useMemo(
    () => Object.fromEntries(repositories?.map(repo => [repo.id, repo]) ?? []),
    [repositories]
  );

  const selectedRepositories = useMemo(
    () =>
      Object.entries(selectedRepositoriesMap)
        .filter(([_, isSelected]) => isSelected)
        .map(([repoId]) => repositoriesMap[repoId])
        .filter(repo => repo !== undefined),
    [selectedRepositoriesMap, repositoriesMap]
  );

  const handleStepChange = useCallback(
    (newStep: number) => {
      setCurrentStep(newStep);
    },
    [setCurrentStep]
  );

  useEffect(() => {
    // If we have *any* valid GitHub installations, we can skip to next step
    if (
      currentStep === 1 &&
      !isInstallationPending &&
      installationData?.find(installation => installation.provider.key === 'github')
    ) {
      handleStepChange(2);
    }
  }, [
    currentStep,
    isInstallationPending,
    installationData,
    handleStepChange,
    setCurrentStep,
  ]);

  if (!isInstallationPending && !isProviderPending && !provider) {
    Sentry.logger.error('Seer: No valid integration found for Seer onboarding');
    return <Alert type="error">{t('No supported SCM integrations are available')}</Alert>;
  }

  return (
    <Fragment>
      <ConnectGithubStep
        installationData={installationData}
        isInstallationPending={isInstallationPending}
        provider={provider}
        isProviderPending={isProviderPending}
      />

      <ConfigureCodeReviewStep
        provider={provider}
        repositories={repositories}
        isFetching={isFetching}
        selectedRepositoriesMap={selectedRepositoriesMap}
        onRepositorySelectionChange={handleRepositorySelectionChange}
      />

      <ConfigureRootCauseAnalysisStep selectedRepositories={selectedRepositories} />

      <NextStepsStep repositories={selectedRepositories} />
    </Fragment>
  );
}
