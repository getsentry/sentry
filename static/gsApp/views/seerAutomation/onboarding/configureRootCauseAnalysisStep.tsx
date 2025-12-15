import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import configureRootCauseAnalysisImg from 'sentry-images/spot/seer-config-connect-2.svg';

import {Button} from '@sentry/scraps/button';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout/flex';
import {Switch} from 'sentry/components/core/switch';
import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {useSeerOnboardingContext} from './hooks/seerOnboardingContext';
import {useCodeMappings} from './hooks/useCodeMappings';
import {
  useSubmitSeerOnboarding,
  type BackendRepository,
} from './hooks/useSubmitSeerOnboarding';
import {
  Field,
  FieldDescription,
  FieldLabel,
  MaxWidthPanel,
  PanelDescription,
  StepContent,
} from './common';
import {RepositoryToProjectConfiguration} from './repositoryToProjectConfiguration';

export function ConfigureRootCauseAnalysisStep() {
  const organization = useOrganization();
  const [proposeFixesEnabled, setProposeFixesEnabled] = useState(
    organization.defaultAutofixAutomationTuning !== 'off'
  );
  const [autoCreatePREnabled, setAutoCreatePREnabled] = useState(
    organization.autoOpenPrs ?? false
  );

  const {currentStep, setCurrentStep} = useGuidedStepsContext();
  const {
    selectedRootCauseAnalysisRepositories,
    repositoryProjectMapping,
    changeRepositoryProjectMapping,
    changeRootCauseAnalysisRepository,
    addRootCauseAnalysisRepository,
    addRepositoryProjectMappings,
    repositories,
  } = useSeerOnboardingContext();

  const {
    projects,
    initiallyLoaded: isProjectsLoaded,
    fetching: isProjectsFetching,
  } = useProjects();

  const {codeMappingsMap, isLoading: isCodeMappingsLoading} = useCodeMappings({
    enabled: selectedRootCauseAnalysisRepositories.length > 0,
  });

  const {mutate: submitOnboarding, isPending: isSubmitOnboardingPending} =
    useSubmitSeerOnboarding();

  useEffect(() => {
    if (!isCodeMappingsLoading && codeMappingsMap.size > 0) {
      const additionalMappings: Record<string, string[]> = {};
      selectedRootCauseAnalysisRepositories.forEach(repo => {
        const mappedProjects = Array.from(codeMappingsMap.get(repo.id) || []);
        additionalMappings[repo.id] = mappedProjects;
      });
      addRepositoryProjectMappings(additionalMappings);
    }
  }, [
    isCodeMappingsLoading,
    selectedRootCauseAnalysisRepositories,
    codeMappingsMap,
    addRepositoryProjectMappings,
  ]);

  const handlePreviousStep = useCallback(() => {
    setCurrentStep(currentStep - 1);
  }, [setCurrentStep, currentStep]);

  const handleNextStep = useCallback(() => {
    // Build a map from repo ID to full repo object
    const repoMap = new Map(
      selectedRootCauseAnalysisRepositories.map(repo => [repo.id, repo])
    );

    // Transform repositoryProjectMapping from {repoId: projectIds[]} to {projectId: repos[]}
    const projectRepoMapping: Record<string, BackendRepository[]> = {};
    for (const [repoId, projectIds] of Object.entries(repositoryProjectMapping)) {
      const repo = repoMap.get(repoId);
      if (!repo) {
        continue;
      }
      for (const projectId of projectIds) {
        if (!projectRepoMapping[projectId]) {
          projectRepoMapping[projectId] = [];
        }

        // repo.name = `githubOrg/repositoryName`, need to split it for backend
        const [owner, name] = (repo.name || '/').split('/');
        if (!owner || !name || !repo.provider) {
          Sentry.logger.error('Seer Onboarding: Invalid repository name', {
            repoName: repo.name,
          });
          continue;
        }
        projectRepoMapping[projectId].push({
          external_id: repo.externalId,
          integration_id: repo.integrationId,
          organization_id: parseInt(organization.id, 10),
          owner,
          provider: repo.provider?.name,
          name,
        });
      }
    }

    // Only submit if RCA is disabled (empty mapping is fine) or there are valid mappings
    const hasMappings = Object.keys(projectRepoMapping).length > 0;
    if (proposeFixesEnabled && !hasMappings) {
      addErrorMessage(t('At least one repository must be mapped to a project'));
      return;
    }

    submitOnboarding(
      {
        fixes: proposeFixesEnabled,
        pr_creation: autoCreatePREnabled,
        project_repo_mapping: projectRepoMapping,
      },
      {
        onSuccess: () => {
          setCurrentStep(currentStep + 1);
        },
        onError: () => {
          addErrorMessage(t('Failed to save settings'));
        },
      }
    );
  }, [
    setCurrentStep,
    currentStep,
    submitOnboarding,
    repositoryProjectMapping,
    selectedRootCauseAnalysisRepositories,
    proposeFixesEnabled,
    autoCreatePREnabled,
    organization.id,
  ]);

  const handleRepositoryProjectMappingsChange = useCallback(
    (repoId: string, index: number, newValue: string | undefined) => {
      const currentProjects = repositoryProjectMapping[repoId] || [];

      if (newValue && currentProjects.includes(newValue)) {
        // Project is already mapped to this repo, show an error message and don't update anything
        // We could make our dropdowns smarter by filtering out selected projects,
        // but this is much simpler.
        addErrorMessage(t('Project is already mapped to this repo'));
        return;
      }

      changeRepositoryProjectMapping(repoId, index, newValue);
    },
    [changeRepositoryProjectMapping, repositoryProjectMapping]
  );

  const availableRepositories = useMemo(() => {
    return (
      repositories?.filter(
        repo =>
          !selectedRootCauseAnalysisRepositories.some(selected => selected.id === repo.id)
      ) ?? []
    );
  }, [repositories, selectedRootCauseAnalysisRepositories]);

  const repositoryOptions = useMemo(() => {
    return availableRepositories.map(repo => ({
      value: repo.id,
      label: repo.name,
      textValue: repo.name,
    }));
  }, [availableRepositories]);

  const handleAddRepository = useCallback(
    (option: SelectOption<string>) => {
      addRootCauseAnalysisRepository(option.value);
    },
    [addRootCauseAnalysisRepository]
  );

  // We don't want to allow the user to finish the step if there are no projects mapped to the repositories.
  // It is ok to advance if there are no repositories selected because they'll have configured the RCA/Auto PR creation settings.
  const isFinishDisabled = useMemo(() => {
    const mappings = Object.values(repositoryProjectMapping);
    return (
      mappings.length !== selectedRootCauseAnalysisRepositories.length ||
      Boolean(mappings.some(mappedProjects => mappedProjects.length === 0))
    );
  }, [repositoryProjectMapping, selectedRootCauseAnalysisRepositories.length]);

  return (
    <Fragment>
      <StepContentWithBackground>
        <MaxWidthPanel>
          <PanelBody>
            <PanelDescription>
              <p>
                {t(
                  'Pair your projects with your repositories to make sure Seer can analyze your codebase.'
                )}
              </p>
            </PanelDescription>

            <Field>
              <Flex direction="column" flex="1" gap="xs">
                <FieldLabel>{t('Enable Root Cause Analysis')}</FieldLabel>
                <FieldDescription>
                  <Text>
                    {t(
                      'For all new projects, Seer will automatically analyze highly actionable issues, create a root cause analysis, and propose a solution. '
                    )}
                  </Text>
                </FieldDescription>
              </Flex>
              <Switch
                size="lg"
                checked={proposeFixesEnabled}
                onChange={() => setProposeFixesEnabled(!proposeFixesEnabled)}
              />
            </Field>
            <Field>
              <Flex direction="column" flex="1" gap="xs">
                <FieldLabel>{t('Automatic PR Creation')}</FieldLabel>
                <FieldDescription>
                  {t(
                    'For all projects below AND newly added projects, Seer will be able to create a pull request.'
                  )}
                </FieldDescription>
              </Flex>
              <Switch
                size="lg"
                checked={autoCreatePREnabled}
                onChange={() => setAutoCreatePREnabled(!autoCreatePREnabled)}
              />
            </Field>

            {isProjectsLoaded && !isProjectsFetching ? (
              <Fragment>
                <RepositoryToProjectConfiguration
                  isPending={isCodeMappingsLoading}
                  projects={projects}
                  onChange={handleRepositoryProjectMappingsChange}
                  onChangeRepository={changeRootCauseAnalysisRepository}
                />
                {availableRepositories.length > 0 && (
                  <AddRepoRow>
                    <CompactSelect
                      size="sm"
                      searchable
                      value={undefined}
                      strategy="fixed"
                      triggerProps={{
                        icon: <IconAdd />,
                        children: t('Add Repository'),
                      }}
                      onChange={handleAddRepository}
                      options={repositoryOptions}
                      menuTitle={t('Select Repository')}
                    />
                  </AddRepoRow>
                )}
              </Fragment>
            ) : (
              <Flex direction="column" gap="md" padding="md">
                {selectedRootCauseAnalysisRepositories.map(repository => (
                  <Placeholder key={repository.id} />
                ))}
              </Flex>
            )}
          </PanelBody>
        </MaxWidthPanel>
      </StepContentWithBackground>

      <GuidedSteps.ButtonWrapper>
        <Button size="md" onClick={handlePreviousStep} aria-label={t('Previous Step')}>
          {t('Previous Step')}
        </Button>
        <Button
          size="md"
          onClick={handleNextStep}
          priority={isFinishDisabled ? 'default' : 'primary'}
          disabled={isSubmitOnboardingPending || isFinishDisabled}
          aria-label={t('Last Step')}
        >
          {t('Last Step')}
        </Button>
        {isSubmitOnboardingPending && <InlineLoadingIndicator size={20} />}
      </GuidedSteps.ButtonWrapper>
    </Fragment>
  );
}

const StepContentWithBackground = styled(StepContent)`
  background: url(${configureRootCauseAnalysisImg}) no-repeat 638px 0;
  background-size: 200px 256px;
`;

const AddRepoRow = styled(PanelItem)`
  align-items: center;
  justify-content: flex-end;
`;

const InlineLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
`;
