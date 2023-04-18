import {useMemo} from 'react';

import useProjects from 'sentry/utils/useProjects';

export function useProjectsWithReplays() {
  const {projects} = useProjects();
  return useMemo(() => projects.filter(p => p.hasReplays), [projects]);
}
