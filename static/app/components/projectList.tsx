import type {ReactNode} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';
import {Tooltip} from '@sentry/scraps/tooltip';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import type {AvatarProject, Project} from 'sentry/types/project';
import {useProjects} from 'sentry/utils/useProjects';

type ProjectListProps = {
  projectSlugs: string[];
  className?: string;
  collapsedProjectsTooltip?: (projects: Array<Project | {slug: string}>) => ReactNode;
  maxVisibleProjects?: number;
  /**
   * When set, project chips become clickable buttons instead of project-details
   * links. The callback receives the project that was clicked.
   */
  onProjectClick?: (project: AvatarProject) => void;
};

function CollapsedProjectsTooltip({
  projects,
  onProjectClick,
}: {
  projects: AvatarProject[];
  onProjectClick?: (project: AvatarProject) => void;
}) {
  return (
    <Stack gap="xs" width="200px">
      {projects.map(project =>
        onProjectClick ? (
          <SlugButton
            key={project.slug}
            type="button"
            onClick={() => onProjectClick(project)}
          >
            <ProjectBadge project={project} avatarSize={16} disableLink />
          </SlugButton>
        ) : (
          <ProjectBadge key={project.slug} project={project} avatarSize={16} />
        )
      )}
    </Stack>
  );
}

export function ProjectList({
  projectSlugs,
  maxVisibleProjects = 2,
  collapsedProjectsTooltip,
  onProjectClick,
  className,
}: ProjectListProps) {
  const {projects} = useProjects({slugs: projectSlugs});

  const projectAvatars = projectSlugs.map(slug => {
    return projects.find(project => project.slug === slug) ?? {slug};
  });
  const numProjects = projectAvatars.length;
  const numVisibleProjects =
    maxVisibleProjects - numProjects >= 0 ? numProjects : maxVisibleProjects - 1;
  const visibleProjectAvatars = projectAvatars.slice(0, numVisibleProjects).reverse();
  const collapsedProjectAvatars = projectAvatars.slice(numVisibleProjects);
  const numCollapsedProjects = collapsedProjectAvatars.length;

  return (
    <ProjectListWrapper className={className}>
      {numCollapsedProjects > 0 && (
        <Tooltip
          skipWrapper
          disabled={collapsedProjectsTooltip === null}
          title={
            collapsedProjectsTooltip ? (
              collapsedProjectsTooltip(collapsedProjectAvatars)
            ) : (
              <CollapsedProjectsTooltip
                projects={collapsedProjectAvatars}
                onProjectClick={onProjectClick}
              />
            )
          }
        >
          <CollapsedBadge
            size={20}
            fontSize={10}
            data-test-id="collapsed-projects-badge"
            $clickable={Boolean(onProjectClick)}
          >
            +{numCollapsedProjects}
          </CollapsedBadge>
        </Tooltip>
      )}
      {visibleProjectAvatars.map(project => (
        <StyledProjectBadge
          key={project.slug}
          hideName
          project={project}
          avatarSize={16}
          avatarProps={{hasTooltip: true, tooltip: project.slug}}
          disableLink={Boolean(onProjectClick)}
          onClick={onProjectClick ? () => onProjectClick(project) : undefined}
          $clickable={Boolean(onProjectClick)}
        />
      ))}
    </ProjectListWrapper>
  );
}

const ProjectListWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
  justify-content: flex-end;
  padding-right: 8px;
`;

const AvatarStyle = (p: {theme: Theme; $clickable?: boolean}) => css`
  /* oxlint-disable-next-line @sentry/scraps/use-semantic-token */
  border: 2px solid ${p.theme.tokens.background.primary};
  margin-right: -8px;
  cursor: ${p.$clickable ? 'pointer' : 'default'};

  &:hover {
    z-index: 1;
  }
`;

const StyledProjectBadge = styled(ProjectBadge, {
  shouldForwardProp: prop => prop !== '$clickable',
})<{$clickable?: boolean}>`
  overflow: hidden;
  z-index: 0;
  ${AvatarStyle}

  ${p =>
    p.$clickable &&
    css`
      img {
        cursor: pointer;
      }
    `}
`;

const CollapsedBadge = styled('div')<{
  fontSize: number;
  size: number;
  $clickable?: boolean;
}>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  text-align: center;
  font-weight: ${p => p.theme.font.weight.sans.medium};
  background-color: ${p => p.theme.colors.gray200};
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.fontSize}px;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  border-radius: ${p => p.theme.radius.md};
  ${AvatarStyle}
`;

const SlugButton = styled('button')`
  all: unset;
  display: flex;
  align-items: center;
  cursor: pointer;
  color: ${p => p.theme.tokens.content.accent};
`;
