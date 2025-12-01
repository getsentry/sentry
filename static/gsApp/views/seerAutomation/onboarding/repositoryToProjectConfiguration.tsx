import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';
import sortBy from 'lodash/sortBy';

import type {SelectOptionOrSection} from 'sentry/components/core/compactSelect';
import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Switch} from 'sentry/components/core/switch';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {HybridFilter} from 'sentry/components/organizations/hybridFilter';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconGithub} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Repository, RepositoryProjectPathConfig} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

interface RepositoryToProjectConfigurationProps {
  repositories: Repository[];
}

export function RepositoryToProjectConfiguration({
  repositories,
}: RepositoryToProjectConfigurationProps) {
  const organization = useOrganization();
  const {projects, initiallyLoaded: projectsLoaded} = useProjects();

  const [proposeFixesEnabled, setProposeFixesEnabled] = useState(true);
  const [autoCreatePREnabled, setAutoCreatePREnabled] = useState(false);
  const [repositoryProjectMappings, setRepositoryProjectMappings] = useState<
    Record<string, string[]>
  >({});

  const [memberProjects, nonMemberProjects] = useMemo(
    () => partition(projects, project => project.isMember),
    [projects]
  );

  // Fetch code mappings to prepopulate
  const {data: codeMappings} = useApiQuery<RepositoryProjectPathConfig[]>(
    [`/organizations/${organization.slug}/code-mappings/`],
    {
      staleTime: Infinity,
      enabled: repositories.length > 0,
    }
  );

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
      repositories.forEach(repo => {
        const mappedProjects = codeMappingsMap.get(repo.id) || [];
        initialMappings[repo.id] = mappedProjects;
      });
      setRepositoryProjectMappings(initialMappings);
    }
  }, [codeMappingsMap, repositories, repositoryProjectMappings]);

  const handleProjectsChange = useCallback((repoId: string, projectSlugs: string[]) => {
    setRepositoryProjectMappings(prev => ({
      ...prev,
      [repoId]: projectSlugs,
    }));
  }, []);

  // Convert projects to options for HybridFilter
  const projectOptions = useMemo<Array<SelectOptionOrSection<string>>>(() => {
    const getProjectItem = (project: Project) => ({
      value: project.slug,
      label: project.slug,
      leadingItems: (
        <ProjectBadge project={project} avatarSize={16} hideName disableLink />
      ),
    });

    const listSort = (project: Project) => [!project.isBookmarked, project.slug];

    return nonMemberProjects.length > 0
      ? [
          {
            key: 'my-projects',
            label: t('My Projects'),
            options: sortBy(memberProjects, listSort).map(getProjectItem),
            showToggleAllButton: true,
          },
          {
            key: 'other-projects',
            label: t('Other Projects'),
            options: sortBy(nonMemberProjects, listSort).map(getProjectItem),
          },
        ]
      : sortBy(memberProjects, listSort).map(getProjectItem);
  }, [memberProjects, nonMemberProjects]);

  return (
    <Fragment>
      <FormField>
        <FormFieldContent>
          <FormFieldLabel>{t('Propose Fixes For Root Cause Analysis')}</FormFieldLabel>
          <FormFieldDescription>
            {t(
              'For all projects below, Seer will automatically analyze highly actionable issues, and create a root cause analysis and proposed solution without a user needing to prompt it.'
            )}
          </FormFieldDescription>
        </FormFieldContent>
        <Switch
          size="lg"
          checked={proposeFixesEnabled}
          onToggle={() => setProposeFixesEnabled(!proposeFixesEnabled)}
        />
      </FormField>

      <FormField>
        <FormFieldContent>
          <FormFieldLabel>{t('Automatic PR Creation')}</FormFieldLabel>
          <FormFieldDescription>
            {t('For all projects below, Seer will be able to make a pull request.')}
          </FormFieldDescription>
        </FormFieldContent>
        <Switch
          size="lg"
          checked={autoCreatePREnabled}
          onChange={() => setAutoCreatePREnabled(!autoCreatePREnabled)}
        />
      </FormField>

      {repositories.length > 0 &&
        repositories.map(repository => {
          const selectedProjects = repositoryProjectMappings[repository.id] || [];

          return (
            <MappingItem key={repository.id}>
              <RepositoryInputGroup>
                <InputGroup.LeadingItems>
                  <IconGithub size="sm" />
                </InputGroup.LeadingItems>
                <InputGroup.Input
                  type="text"
                  value={repository.name}
                  readOnly
                  size="sm"
                />
              </RepositoryInputGroup>

              <ProjectSelectorWrapper>
                <HybridFilter
                  multiple
                  checkboxPosition="trailing"
                  size="sm"
                  searchable
                  value={selectedProjects}
                  defaultValue={[]}
                  onChange={projectSlugs =>
                    handleProjectsChange(repository.id, projectSlugs)
                  }
                  options={projectOptions}
                  disabled={!projectsLoaded}
                  emptyMessage={t('No projects found')}
                  menuTitle={t('Select Projects')}
                  menuWidth="auto"
                  sizeLimit={25}
                  sizeLimitMessage={t('Use search to find more projects…')}
                  strategy="fixed"
                />
              </ProjectSelectorWrapper>
            </MappingItem>
          );
        })}
    </Fragment>
  );
}

const FormField = styled(PanelItem)`
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: ${space(2)};
  padding: ${space(2)} ${space(2)};
`;

const FormFieldContent = styled('div')`
  flex: 1;
`;

const FormFieldLabel = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-bottom: ${space(0.5)};
`;

const FormFieldDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  line-height: 1.4;
`;

const MappingItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${space(2)};
  align-items: center;
  padding: ${space(2)};
`;

const RepositoryInputGroup = styled(InputGroup)`
  width: 100%;
`;

const ProjectSelectorWrapper = styled('div')`
  width: 100%;
`;
