import React from 'react';
import styled from '@emotion/styled';

import {tct, t} from 'app/locale';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {Project} from 'app/types';
import space from 'app/styles/space';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import Hovercard, {Body as HoverCardBody} from 'app/components/hovercard';

const MAX_PROJECTS_IN_HOVERCARD = 5;

type Props = {
  projects: Project[];
  orgId: string;
  version: string;
  maxLines?: number;
};

const ProjectList = ({projects, orgId, version, maxLines = 2}: Props) => {
  let visibleProjects: Project[], hiddenProjects: Project[];

  if (projects.length <= maxLines) {
    visibleProjects = projects;
    hiddenProjects = [];
  } else {
    // because we need one line for `and X more`
    visibleProjects = projects.slice(0, maxLines - 1);
    hiddenProjects = projects.slice(maxLines - 1, projects.length);
  }

  const hoverCardHead = t('Release Projects');
  const hovercardBody = (
    <HovercardContentWrapper>
      <ProjectList
        projects={hiddenProjects}
        orgId={orgId}
        version={version}
        maxLines={MAX_PROJECTS_IN_HOVERCARD}
      />
    </HovercardContentWrapper>
  );

  return (
    <React.Fragment>
      {visibleProjects.map(project => (
        <StyledProjectBadge project={project} avatarSize={14} key={project.slug} />
      ))}
      {hiddenProjects.length > 0 && (
        <StyledHovercard
          header={hoverCardHead}
          body={hovercardBody}
          show={hiddenProjects.length <= MAX_PROJECTS_IN_HOVERCARD ? undefined : false}
        >
          <GlobalSelectionLink
            to={`/organizations/${orgId}/releases/${encodeURIComponent(version)}/`}
          >
            {tct('and [count] more', {
              count: hiddenProjects.length,
            })}
          </GlobalSelectionLink>
        </StyledHovercard>
      )}
    </React.Fragment>
  );
};

const StyledProjectBadge = styled(ProjectBadge)`
  &:not(:last-child) {
    margin-bottom: ${space(0.5)};
  }
`;

const StyledHovercard = styled(Hovercard)`
  width: auto;
  max-width: 295px;
  ${HoverCardBody} {
    padding-bottom: 0;
  }
`;
const HovercardContentWrapper = styled('div')`
  display: flex;
  align-items: center;
  justify-content: flex-start;
  flex-wrap: wrap;
  font-size: ${p => p.theme.fontSizeMedium};
  ${StyledProjectBadge} {
    margin-right: ${space(3)};
    margin-bottom: ${space(2)};
  }
`;
export default ProjectList;
