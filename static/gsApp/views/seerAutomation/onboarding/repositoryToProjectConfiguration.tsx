import {Fragment, memo, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {Alert} from '@sentry/scraps/alert/alert';

import {Flex} from 'sentry/components/core/layout/flex';
import {Select} from 'sentry/components/core/select';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {IconArrow, IconRepository} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Repository} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';

import {useSeerOnboardingContext} from './hooks/seerOnboardingContext';

interface RepositoryToProjectConfigurationProps {
  isPending: boolean;
  onChange: (repoId: string, inedx: number, newValue: string | undefined) => void;
  onChangeRepository: (oldRepoId: string, newRepoId: string) => void;
  projects: Project[];
}

export function RepositoryToProjectConfiguration({
  isPending,
  onChange,
  onChangeRepository,
  projects,
}: RepositoryToProjectConfigurationProps) {
  const [memberProjects, nonMemberProjects] = useMemo(
    () => partition(projects, project => project.isMember),
    [projects]
  );
  const {
    selectedRootCauseAnalysisRepositories,
    repositoryProjectMapping,
    removeRootCauseAnalysisRepository,
    repositories,
  } = useSeerOnboardingContext();

  // Create a set of selected repository IDs for efficient lookup
  const selectedRepoIds = useMemo(
    () => new Set(selectedRootCauseAnalysisRepositories.map(repo => repo.id)),
    [selectedRootCauseAnalysisRepositories]
  );

  const isValidMappings = useMemo(() => {
    const repos = new Set(selectedRootCauseAnalysisRepositories.map(repo => repo.id));
    const repoList = Object.entries(repositoryProjectMapping).filter(([repoId]) =>
      repos.has(repoId)
    );
    const result = repoList.every(([, projectIds]) => projectIds.length > 0);
    return repoList.length === selectedRootCauseAnalysisRepositories.length && result;
  }, [repositoryProjectMapping, selectedRootCauseAnalysisRepositories]);

  return (
    <Fragment>
      {!isPending && !isValidMappings && (
        <Alert variant="danger">
          {t('Each repository must have at least one project mapped')}
        </Alert>
      )}

      {selectedRootCauseAnalysisRepositories.length > 0 &&
        selectedRootCauseAnalysisRepositories.map(repository => {
          // Filter repository options to exclude already-selected ones
          // (except the current repository being edited)
          const availableRepositoryOptions =
            repositories
              ?.filter(repo => !selectedRepoIds.has(repo.id) || repo.id === repository.id)
              .map(repo => ({
                value: repo.id,
                label: repo.name,
                textValue: repo.name,
              })) ?? [];

          return (
            <RepositoryRow
              isPending={isPending}
              key={repository.id}
              memberProjects={memberProjects}
              nonMemberProjects={nonMemberProjects}
              selectedProjects={repositoryProjectMapping[repository.id] || []}
              repository={repository}
              repositories={availableRepositoryOptions}
              onRemoveRepository={removeRootCauseAnalysisRepository}
              onChangeRepository={onChangeRepository}
              onChange={onChange}
            />
          );
        })}
    </Fragment>
  );
}

interface RepositoryRowProps {
  isPending: boolean;
  memberProjects: Project[];
  nonMemberProjects: Project[];
  onChange: (repoId: string, index: number, newValue: string | undefined) => void;
  onChangeRepository: (oldRepoId: string, newRepoId: string) => void;
  onRemoveRepository: (repoId: string) => void;
  repositories: Array<SelectValue<string>>;
  repository: Repository;
  selectedProjects: string[];
}
const RepositoryRow = memo(function RepositoryRow({
  isPending,
  repository,
  repositories,
  onRemoveRepository,
  onChangeRepository,
  selectedProjects,
  memberProjects,
  nonMemberProjects,
  onChange,
}: RepositoryRowProps) {
  // Convert projects to options for Select
  const projectOptions = useMemo(() => {
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

  const handleRepositoryChange = useCallback(
    (option: SelectValue<string> | null) => {
      if (option === null) {
        onRemoveRepository?.(repository.id);
        return;
      }

      if (option?.value && option.value !== repository.id) {
        onChangeRepository(repository.id, option.value);
      }
    },
    [repository.id, onChangeRepository, onRemoveRepository]
  );

  return (
    <MappingItem key={repository.id}>
      <Select
        size="sm"
        searchable
        clearable
        value={repository.id}
        onChange={handleRepositoryChange}
        options={repositories}
        noOptionsMessage={() => t('No repositories found')}
        menuPortalTarget={document.body}
        prefix={<IconRepository size="sm" />}
      />

      <Arrow direction="right" size="lg" />

      {isPending ? (
        <Placeholder height="100%" />
      ) : (
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
                  onChange(repository.id, index, option?.value)
                }
                options={projectOptions}
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
                onChange(repository.id, selectedProjects.length, option?.value)
              }
              options={projectOptions}
              placeholder={t('Add project')}
              noOptionsMessage={() => t('No projects found')}
              menuPortalTarget={document.body}
            />
          </ProjectDropdownRow>
        </Flex>
      )}
    </MappingItem>
  );
});

function getProjectItem(project: Project) {
  return {
    value: project.id,
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
  };
}

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

const ProjectDropdownRow = styled('div')`
  width: 100%;
`;
