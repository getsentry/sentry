import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import type {Project} from 'sentry/types/project';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {ProjectsRenderer} from 'sentry/views/explore/tables/tracesTable/fieldRenderers';
import {
  TraceShape,
  type TraceTree,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {useTraceStateDispatch} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

type Props = {
  logs: OurLogsResponseItem[] | undefined;
  projects: Project[];
  tree: TraceTree;
};

function Projects({projects, logs, tree}: Props) {
  const dispatch = useTraceStateDispatch();

  const onProjectClick = useCallback(
    (projectSlug: string) => {
      dispatch({type: 'set query', query: `project:${projectSlug}`, source: 'external'});
    },
    [dispatch]
  );

  const projectSlugs = useMemo(() => {
    if (logs && logs.length > 0 && tree.shape === TraceShape.EMPTY_TRACE) {
      // Get unique project slugs in a single pass
      const projectIdToSlug = new Map(projects.map(p => [p.id, p.slug]));
      const uniqueSlugs = new Set<string>();

      for (const log of logs) {
        const projectId = String(log[OurLogKnownFieldKey.PROJECT_ID]);
        const slug = projectIdToSlug.get(projectId);
        if (slug) {
          uniqueSlugs.add(slug);
        }
      }

      return Array.from(uniqueSlugs);
    }

    // If there are no logs, or the trace is not empty, use the projects from the tree
    return Array.from(
      new Set(Array.from(tree.projects.values()).map(project => project.slug))
    );
  }, [tree.projects, tree.shape, logs, projects]);

  return (
    <ProjectsRendererWrapper>
      <ProjectsRenderer
        disableLink
        onProjectClick={onProjectClick}
        projectSlugs={projectSlugs}
        visibleAvatarSize={24}
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

export default Projects;
