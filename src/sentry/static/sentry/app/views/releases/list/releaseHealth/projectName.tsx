import React from 'react';
import styled from '@emotion/styled';

import GlobalSelectionLink from 'app/components/globalSelectionLink';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import space from 'app/styles/space';
import {ReleaseProject} from 'app/types';

type Props = {
  orgSlug: string;
  releaseVersion: string;
  project: ReleaseProject;
};

const ProjectName = ({orgSlug, releaseVersion, project}: Props) => (
  <GlobalSelectionLink
    to={{
      pathname: `/organizations/${orgSlug}/releases/${encodeURIComponent(
        releaseVersion
      )}/`,
      query: {project: project.id},
    }}
  >
    <StyledProjectBadge project={project} avatarSize={16} />
  </GlobalSelectionLink>
);

export default ProjectName;

const StyledProjectBadge = styled(ProjectBadge)`
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-right: ${space(1)};
  }
`;
