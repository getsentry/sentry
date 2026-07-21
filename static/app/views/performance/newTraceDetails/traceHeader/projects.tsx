import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {ProjectsRenderer} from 'sentry/views/explore/tables/tracesTable/fieldRenderers';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useTraceStateDispatch} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

type Props = {
  tree: TraceTree;
};

export function Projects({tree}: Props) {
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

  const projectSlugs = useMemo(() => {
    return Array.from(
      new Set(Array.from(tree.projects.values()).map(project => project.slug))
    );
  }, [tree.projects]);

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

// We cannot change the cursor of the ProjectBadge component so we need to wrap it in a div
const ProjectsRendererWrapper = styled('div')`
  img {
    cursor: pointer;
  }
`;
