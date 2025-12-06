import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Flex} from 'sentry/components/core/layout/flex';
import {Switch} from 'sentry/components/core/switch';
import {
  GuidedSteps,
  useGuidedStepsContext,
} from 'sentry/components/guidedSteps/guidedSteps';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Repository, RepositoryProjectPathConfig} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {MaxWidthPanel, PanelDescription, StepContent} from './common';
import {RepositoryToProjectConfiguration} from './repositoryToProjectConfiguration';

interface ConfigureRootCauseAnalysisStepProps {
  /**
   * Selected repositories from the repository selector step.
   */
  selectedRepositories: Repository[];
}

export function ConfigureRootCauseAnalysisStep({
  selectedRepositories,
}: ConfigureRootCauseAnalysisStepProps) {
  const {currentStep, setCurrentStep} = useGuidedStepsContext();
  // Need local state so you can remove repositories (and maybe add new ones)
  const [repositories, setRepositories] = useState<Repository[]>(selectedRepositories);
  const [proposeFixesEnabled, setProposeFixesEnabled] = useState(true);
  const [autoCreatePREnabled, setAutoCreatePREnabled] = useState(true);

  const [repositoryProjectMappings, setRepositoryProjectMappings] = useState<
    Record<string, string[]>
  >({});
  const organization = useOrganization();
  const {
    projects,
    initiallyLoaded: isProjectsLoaded,
    fetching: isProjectsFetching,
  } = useProjects();

  // Fetch code mappings to prepopulate
  const {data: codeMappings, isPending: isCodeMappingsPending} = useApiQuery<
    RepositoryProjectPathConfig[]
  >([`/organizations/${organization.slug}/code-mappings/`], {
    staleTime: Infinity,
    enabled: selectedRepositories.length > 0,
  });

  // Create a map of repository ID to project slugs based on code mappings
  const codeMappingsMap = useMemo(() => {
    if (!codeMappings) {
      return new Map<string, string[]>();
    }

    const map = new Map<string, string[]>();
    codeMappings.forEach(mapping => {
      const existingProjects = map.get(mapping.repoId) || [];
      if (!existingProjects.includes(mapping.projectSlug)) {
        map.set(mapping.repoId, [...existingProjects, mapping.projectSlug]);
      }
    });

    return map;
  }, [codeMappings]);

  // Initialize mappings from code mappings when they're available
  useEffect(() => {
    if (codeMappingsMap.size > 0 && Object.keys(repositoryProjectMappings).length === 0) {
      const initialMappings: Record<string, string[]> = {};
      selectedRepositories.forEach(repo => {
        const mappedProjects = codeMappingsMap.get(repo.id) || [];
        initialMappings[repo.id] = mappedProjects;
      });
      setRepositoryProjectMappings(initialMappings);
    }
  }, [codeMappingsMap, selectedRepositories, repositoryProjectMappings]);

  const handleNextStep = useCallback(() => {
    // TODO: Save to backend
    setCurrentStep(currentStep + 1);
  }, [setCurrentStep, currentStep]);

  const handleRepositoryProjectMappingsChange = useCallback(
    (repoId: string, index: number, newValue: string | undefined) => {
      setRepositoryProjectMappings(prev => {
        const currentProjects = prev[repoId] || [];

        if (newValue && currentProjects.includes(newValue)) {
          // Project is already mapped to this repo, show an error message and don't update anything
          // We could make our dropdowns smarter by filtering out selected projects,
          // but this is much simpler.
          addErrorMessage(t('Project is already mapped to this repo'));
          return prev;
        }

        const newProjects = [...currentProjects];

        if (newValue === undefined) {
          // Remove the project at this index
          newProjects.splice(index, 1);
        } else if (index >= newProjects.length) {
          // Adding a new project
          newProjects.push(newValue);
        } else {
          // Replacing an existing project
          newProjects[index] = newValue;
        }

        const result = {
          ...prev,
          [repoId]: newProjects,
        };

        return result;
      });
    },
    [setRepositoryProjectMappings]
  );

  const handleRemoveRepository = useCallback(
    (repoId: string) => {
      setRepositoryProjectMappings(prev => {
        const newMappings = {...prev};
        delete newMappings[repoId];
        return newMappings;
      });
      setRepositories(prev => prev.filter(repo => repo.id !== repoId));
    },
    [setRepositoryProjectMappings]
  );

  const isFinishDisabled = useMemo(() => {
    const mappings = Object.values(repositoryProjectMappings);
    return (
      !mappings.length ||
      mappings.length !== repositories.length ||
      Boolean(mappings.some(mappedProjects => mappedProjects.length === 0)) ||
      repositories.length === 0
    );
  }, [repositoryProjectMappings, repositories.length]);

  return (
    <Fragment>
      <StepContent>
        <MaxWidthPanel>
          <PanelBody>
            <PanelDescription>
              <p>
                {t(
                  'Pair your projects with your repositories to enable Seer to analyze your codebase.'
                )}
              </p>
            </PanelDescription>

            <Field>
              <Flex direction="column" flex="1" gap="xs">
                <FieldLabel>{t('Propose Fixes For Root Cause Analysis')}</FieldLabel>
                <FieldDescription>
                  {t(
                    'For all projects below, Seer will automatically analyze highly actionable issues, and create a root cause analysis and proposed solution without a user needing to prompt it.'
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
                  {t('For all projects below, Seer will be able to make a pull request.')}
                </FieldDescription>
              </Flex>
              <Switch
                size="lg"
                checked={autoCreatePREnabled}
                onChange={() => setAutoCreatePREnabled(!autoCreatePREnabled)}
              />
            </Field>

            {isProjectsLoaded && !isProjectsFetching && !isCodeMappingsPending ? (
              <RepositoryToProjectConfiguration
                onRemoveRepository={handleRemoveRepository}
                repositoryProjectMappings={repositoryProjectMappings}
                projects={projects}
                repositories={repositories}
                onChange={handleRepositoryProjectMappingsChange}
              />
            ) : (
              <Placeholder />
            )}
          </PanelBody>
        </MaxWidthPanel>
      </StepContent>

      <GuidedSteps.ButtonWrapper>
        <GuidedSteps.BackButton size="md" />
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

const Field = styled(PanelItem)`
  align-items: start;
  justify-content: space-between;
  gap: ${p => p.theme.space.xl};
`;

const FieldLabel = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const FieldDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  line-height: 1.4;
`;
