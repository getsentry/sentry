import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout/flex';
import {Switch} from 'sentry/components/core/switch';
import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';

import {useSeerOnboardingContext} from './hooks/seerOnboardingContext';
import {useCodeMappings} from './hooks/useCodeMappings';
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
  const [proposeFixesEnabled, setProposeFixesEnabled] = useState(true);
  const [autoCreatePREnabled, setAutoCreatePREnabled] = useState(true);

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
    // TODO: Save to backend
    setCurrentStep(currentStep + 1);
  }, [setCurrentStep, currentStep]);

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

  const isFinishDisabled = useMemo(() => {
    const mappings = Object.values(repositoryProjectMapping);
    return (
      !mappings.length ||
      mappings.length !== selectedRootCauseAnalysisRepositories.length ||
      Boolean(mappings.some(mappedProjects => mappedProjects.length === 0)) ||
      selectedRootCauseAnalysisRepositories.length === 0
    );
  }, [repositoryProjectMapping, selectedRootCauseAnalysisRepositories.length]);

  return (
    <Fragment>
      <StepContent>
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
                  {t(
                    'For all projects below AND newly added projects, Seer will automatically analyze highly actionable issues, create a root cause analysis, and propose a solution.'
                  )}
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
      </StepContent>

      <GuidedSteps.ButtonWrapper>
        <Button size="md" onClick={handlePreviousStep} aria-label={t('Previous Step')}>
          {t('Previous Step')}
        </Button>
        <Button
          size="md"
          onClick={handleNextStep}
          priority={isFinishDisabled ? 'default' : 'primary'}
          disabled={isFinishDisabled}
          aria-label={t('Last Step')}
        >
          {t('Last Step')}
        </Button>
      </GuidedSteps.ButtonWrapper>
    </Fragment>
  );
}

const AddRepoRow = styled(PanelItem)`
  align-items: center;
  justify-content: flex-end;
`;
