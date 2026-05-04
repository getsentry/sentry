import {useMemo} from 'react';

import {useProjects} from 'sentry/utils/useProjects';

export function useProjectsById() {
  const {projects} = useProjects();
  return useMemo(() => new Map(projects.map(p => [p.id, p])), [projects]);
}
