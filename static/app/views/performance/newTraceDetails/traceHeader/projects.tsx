import {useCallback} from 'react';
import styled from '@emotion/styled';

import {ProjectsRenderer} from 'sentry/views/explore/tables/tracesTable/fieldRenderers';
import {useTraceStateDispatch} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

type Props = {
  projectSlugs: string[];
};

export function Projects({projectSlugs}: Props) {
  const dispatch = useTraceStateDispatch();

  const onProjectClick = useCallback(
    (projectSlug: string) => {
      dispatch({
        type: 'set query',
        query: `project:${projectSlug}`,
        source: 'external',
      });
    },
    [dispatch]
  );

  return (
    <ProjectsRendererWrapper>
      <ProjectsRenderer
        disableLink
        onProjectClick={onProjectClick}
        projectSlugs={projectSlugs}
        visibleAvatarSize={20}
        maxVisibleProjects={3}
      />
    </ProjectsRendererWrapper>
  );
}

// We cannot change the cursor or icon separator of the ProjectBadge component so we
// need to wrap it in a div
const ProjectsRendererWrapper = styled('div')`
  img {
    cursor: pointer;
    box-shadow: none;
  }
`;
