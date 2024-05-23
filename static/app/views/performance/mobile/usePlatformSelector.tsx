import {useMemo} from 'react';

import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {PlatformSelector} from 'sentry/views/performance/mobile/screenload/screens/platformSelector';
import {isCrossPlatform} from 'sentry/views/performance/mobile/screenload/screens/utils';

function usePlatformSelector() {
  const {selection} = usePageFilters();
  const {projects} = useProjects();

  const project = useMemo(() => {
    if (selection.projects.length !== 1) {
      return null;
    }

    return projects.find(p => p.id === String(selection.projects));
  }, [projects, selection.projects]);

  const isProjectCrossPlatform = useMemo(
    () => (project ? isCrossPlatform(project) : false),
    [project]
  );

  return {
    project,
    isProjectCrossPlatform,
    PlatformSelector,
  };
}

export default usePlatformSelector;
