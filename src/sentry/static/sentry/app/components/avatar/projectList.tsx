// TODO(matej): needs a little bit of styles tinkering when avatarSize is huge
// pretty similar to src/sentry/static/sentry/app/components/avatar/avatarList.tsx, does it make sense to merge into one reusable list?
import React from 'react';
import styled from '@emotion/styled';

import {tn} from 'app/locale';
import {Project, AvatarProject} from 'app/types';
import Tooltip from 'app/components/tooltip';
import ProjectAvatar from 'app/components/avatar/projectAvatar';

type Props = {
  projects: Project[] | AvatarProject[];
  maxVisibleProjects?: number;
  avatarSize?: number;
};

const ProjectList = ({projects, maxVisibleProjects = 5, avatarSize = 20}: Props) => {
  const visibleProjects = projects.slice(0, maxVisibleProjects);
  const numberOfCollapsedProjects = projects.length - visibleProjects.length;

  return (
    <ProjectListWrapper>
      {numberOfCollapsedProjects > 0 && (
        <Tooltip
          title={tn('%s other project', '%s other projects', numberOfCollapsedProjects)}
        >
          <CollapsedProjects size={avatarSize}>
            {numberOfCollapsedProjects < 100 && <Plus size={avatarSize}>+</Plus>}
            {numberOfCollapsedProjects}
          </CollapsedProjects>
        </Tooltip>
      )}

      {visibleProjects.map(project => (
        <StyledProjectAvatar
          project={project}
          key={project.slug}
          tooltip={project.slug}
          size={avatarSize}
          hasTooltip
        />
      ))}
    </ProjectListWrapper>
  );
};

const StyledProjectAvatar = styled(ProjectAvatar)<{size: number}>`
  position: relative;
  margin-left: -${p => Math.floor(p.size / 10)}px;
  img {
    box-shadow: 0 0 0 3px #fff;
  }
  &:hover {
    z-index: 1;
  }
`;

const ProjectListWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-direction: row-reverse;
  justify-content: flex-end;
  span:last-child ${StyledProjectAvatar} {
    margin-left: 0;
  }
`;

const CollapsedProjects = styled('div')<{size: number}>`
  display: flex;
  justify-content: center;
  align-items: center;
  width: ${p => p.size}px;
  height: ${p => p.size}px;
  border-radius: 3px;
  box-shadow: 0 0 0 3px #fff;
  background-color: ${p => p.theme.gray300};
  color: ${p => p.theme.gray500};
  position: relative;
  margin-left: -${p => Math.floor(p.size / 10)}px;
  font-size: ${p => Math.floor(p.size / 2)}px;
  font-weight: 600;
  cursor: default;
  &:hover {
    z-index: 1;
  }
`;

const Plus = styled('span')<{size: number}>`
  font-size: ${p => Math.floor(p.size / 2)}px;
  font-weight: 600;
  margin-left: 1px;
  margin-right: -1px;
`;

export default ProjectList;
