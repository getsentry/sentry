import {Fragment, memo, useMemo} from 'react';
import styled from '@emotion/styled';
import partition from 'lodash/partition';

import {Button} from '@sentry/scraps/button';

import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {Flex} from 'sentry/components/core/layout/flex';
import {Select} from 'sentry/components/core/select';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {IconArrow, IconClose, IconRepository} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {Repository} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';

import {useSeerOnboardingContext} from './hooks/seerOnboardingContext';

interface RepositoryToProjectConfigurationProps {
  isPending: boolean;
  onChange: (repoId: string, inedx: number, newValue: string | undefined) => void;
  projects: Project[];
}

export function RepositoryToProjectConfiguration({
  isPending,
  onChange,
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
  } = useSeerOnboardingContext();

  return (
    <Fragment>
      {selectedRootCauseAnalysisRepositories.length > 0 &&
        selectedRootCauseAnalysisRepositories.map(repository => {
          return (
            <RepositoryRow
              isPending={isPending}
              key={repository.id}
              memberProjects={memberProjects}
              nonMemberProjects={nonMemberProjects}
              selectedProjects={repositoryProjectMapping[repository.id] || []}
              repository={repository}
              onRemoveRepository={removeRootCauseAnalysisRepository}
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
  onRemoveRepository: (repoId: string) => void;
  repository: Repository;
  selectedProjects: string[];
}
const RepositoryRow = memo(function RepositoryRow({
  isPending,
  repository,
  onRemoveRepository,
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

  return (
    <MappingItem key={repository.id}>
      <RepositoryInputGroup>
        <InputGroup.LeadingItems>
          <IconRepository size="sm" />
        </InputGroup.LeadingItems>
        <InputGroup.Input type="text" value={repository.name} readOnly size="sm" />
        <InputGroup.TrailingItems>
          <Button
            size="zero"
            priority="transparent"
            icon={<IconClose size="sm" />}
            onClick={() => onRemoveRepository?.(repository.id)}
            aria-label={t('Remove repository')}
          />
        </InputGroup.TrailingItems>
      </RepositoryInputGroup>

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

const RepositoryInputGroup = styled(InputGroup)`
  width: 100%;
`;

const ProjectDropdownRow = styled('div')`
  width: 100%;
`;
