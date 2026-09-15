import {useMemo} from 'react';
import orderBy from 'lodash/orderBy';

import {useLocation} from 'sentry/utils/useLocation';
import {useProjects} from 'sentry/utils/useProjects';

export function useInitialDetectorCommonValues() {
  const {projects} = useProjects();
  const {query} = useLocation();
  return useMemo(() => {
    const project = projects.find(candidate => candidate.id === query.project);
    const sorted = orderBy(projects, ['isMember', 'isBookmarked'], ['desc', 'desc']);
    return {
      projectId: project?.id ?? sorted[0]?.id ?? '',
      environment: typeof query.environment === 'string' ? query.environment : '',
      name: typeof query.name === 'string' ? query.name : '',
      owner: typeof query.owner === 'string' ? query.owner : '',
      description: null as string | null,
      workflowIds: [] as string[],
    };
  }, [projects, query.project, query.environment, query.name, query.owner]);
}
