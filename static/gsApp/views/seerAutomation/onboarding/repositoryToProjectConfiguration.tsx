import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Flex} from 'sentry/components/core/layout/flex';
import {Select} from 'sentry/components/core/select';
import {Switch} from 'sentry/components/core/switch';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import PanelItem from 'sentry/components/panels/panelItem';
import {IconArrow, IconRepository} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Repository, RepositoryProjectPathConfig} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

interface RepositoryToProjectConfigurationProps {
  onChange: (repositoryProjectMappings: Record<string, string[]>) => void;
  repositories: Repository[];
}

export function RepositoryToProjectConfiguration({
  repositories,
  onChange,
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

  const handleProjectChange = useCallback(
    (repoId: string, index: number, newValue: string | undefined) => {
      setRepositoryProjectMappings(prev => {
        const currentProjects = prev[repoId] || [];
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

        onChange(result);

        return result;
      });
    },
    [onChange]
  );

  // Convert projects to options for Select
  const projectOptions = useMemo(() => {
    const getProjectItem = (project: Project) => ({
      value: project.slug,
      textValue: project.slug,
      label: (
        <ProjectBadge
          project={project}
          avatarSize={16}
          hideOverflow
          disableLink
          avatarProps={{consistentWidth: true}}
        />
      ),
    });

    return nonMemberProjects.length > 0
      ? [
          {
            label: t('My Projects'),
            options: memberProjects.map(getProjectItem),
          },
          {
            label: t('Other Projects'),
            options: nonMemberProjects.map(getProjectItem),
          },
        ]
      : memberProjects.map(getProjectItem);
  }, [memberProjects, nonMemberProjects]);

  return (
    <Fragment>
      <FormField>
        <Flex direction="column" flex="1" gap="xs">
          <FormFieldLabel>{t('Propose Fixes For Root Cause Analysis')}</FormFieldLabel>
          <FormFieldDescription>
            {t(
              'For all projects below, Seer will automatically analyze highly actionable issues, and create a root cause analysis and proposed solution without a user needing to prompt it.'
            )}
          </FormFieldDescription>
        </Flex>
        <Switch
          size="lg"
          checked={proposeFixesEnabled}
          onChange={() => setProposeFixesEnabled(!proposeFixesEnabled)}
        />
      </FormField>

      <FormField>
        <Flex direction="column" flex="1" gap="xs">
          <FormFieldLabel>{t('Automatic PR Creation')}</FormFieldLabel>
          <FormFieldDescription>
            {t('For all projects below, Seer will be able to make a pull request.')}
          </FormFieldDescription>
        </Flex>
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
                  <IconRepository size="sm" />
                </InputGroup.LeadingItems>
                <InputGroup.Input
                  type="text"
                  value={repository.name}
                  readOnly
                  size="sm"
                />
              </RepositoryInputGroup>

              <Arrow direction="right" size="lg" />

              <Flex direction="column" gap="md" width="100%">
                {/* Render a dropdown for each selected project */}
                {selectedProjects.map((projectSlug, index) => (
                  <ProjectDropdownRow key={`${repository.id}-${index}`}>
                    <Select
                      size="sm"
                      searchable
                      clearable
                      value={projectSlug}
                      onChange={(option: SelectValue<string> | null) =>
                        handleProjectChange(repository.id, index, option?.value)
                      }
                      options={projectOptions}
                      disabled={!projectsLoaded}
                      noOptionsMessage={() => t('No projects found')}
                      menuPortalTarget={document.body}
                    />
                  </ProjectDropdownRow>
                ))}
                {/* Always show one empty dropdown for adding new projects */}
                <ProjectDropdownRow>
                  <Select
                    size="sm"
                    searchable
                    value={null}
                    onChange={(option: SelectValue<string> | null) =>
                      handleProjectChange(
                        repository.id,
                        selectedProjects.length,
                        option?.value
                      )
                    }
                    options={projectOptions}
                    disabled={!projectsLoaded}
                    placeholder={t('Add project')}
                    noOptionsMessage={() => t('No projects found')}
                    menuPortalTarget={document.body}
                  />
                </ProjectDropdownRow>
              </Flex>
            </MappingItem>
          );
        })}
    </Fragment>
  );
}

const FormField = styled(PanelItem)`
  align-items: start;
  justify-content: space-between;
  gap: ${p => p.theme.space.xl};
`;

const FormFieldLabel = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const FormFieldDescription = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
  line-height: 1.4;
`;

// Centers the arrow vertically for the first row
// (can't use align-items: center because projects can have multiple rows)
const Arrow = styled(IconArrow)`
  margin-top: ${p => p.theme.space.xs};
`;

const MappingItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: start;
  gap: ${p => p.theme.space.xl};
`;

const RepositoryInputGroup = styled(InputGroup)`
  width: 100%;
`;

const ProjectDropdownRow = styled('div')`
  width: 100%;
`;
