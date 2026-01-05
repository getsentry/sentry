import type {ReactNode} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {space} from 'sentry/styles/space';
import type {Project} from 'sentry/types/project';
import useProjects from 'sentry/utils/useProjects';

type ProjectListProps = {
  projectSlugs: string[];
  className?: string;
  collapsedProjectsTooltip?: (projects: Array<Project | {slug: string}>) => ReactNode;
  maxVisibleProjects?: number;
};

function DefaultCollapsedProjectsTooltip({
  projects,
}: {
  projects: Array<Project | {slug: string}>;
}) {
  return (
    <CollapsedProjects>
      {projects.map(project => (
        <ProjectBadge key={project.slug} project={project} avatarSize={16} />
      ))}
    </CollapsedProjects>
  );
}
export function ProjectList({
  projectSlugs,
  maxVisibleProjects = 2,
  collapsedProjectsTooltip,
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
          isHoverable
          disabled={collapsedProjectsTooltip === null}
          title={
            collapsedProjectsTooltip ? (
              collapsedProjectsTooltip(collapsedProjectAvatars)
            ) : (
              <DefaultCollapsedProjectsTooltip projects={collapsedProjectAvatars} />
            )
          }
        >
          <CollapsedBadge size={20} fontSize={10} data-test-id="collapsed-projects-badge">
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

const CollapsedProjects = styled('div')`
  width: 200px;
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const AvatarStyle = (p: any) => css`
  border: 2px solid ${p.theme.tokens.background.primary};
  margin-right: -8px;
  cursor: default;

  &:hover {
    z-index: 1;
  }
`;

const StyledProjectBadge = styled(ProjectBadge)`
  overflow: hidden;
  z-index: 0;
  ${AvatarStyle}
`;

const CollapsedBadge = styled('div')<{fontSize: number; size: number}>`
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  text-align: center;
  font-weight: ${p => p.theme.fontWeight.bold};
  background-color: ${p => p.theme.colors.gray200};
  color: ${p => p.theme.subText};
  font-size: ${p => p.fontSize}px;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  border-radius: ${p => p.theme.radius.md};
  ${AvatarStyle}
`;
