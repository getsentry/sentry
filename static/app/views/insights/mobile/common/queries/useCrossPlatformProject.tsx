import {useMemo} from 'react';

import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import useProjects from 'sentry/utils/useProjects';
import {isCrossPlatform} from 'sentry/views/insights/mobile/screenload/utils';

export const PLATFORM_LOCAL_STORAGE_KEY = 'mobile-performance-platform';
export const PLATFORM_QUERY_PARAM = 'platform';
export const DEFAULT_PLATFORM = 'Android';

function useCrossPlatformProject() {
  const {selection} = usePageFilters();
  const {projects} = useProjects();
  const location = useLocation();

  const project = useMemo(() => {
    if (selection.projects.length !== 1) {
      return null;
    }

    return projects.find(p => p.id === String(selection.projects)) ?? null;
  }, [projects, selection.projects]);

  const isProjectCrossPlatform = useMemo(
    () => !!(project && isCrossPlatform(project)),
    [project]
  );

  const selectedPlatform =
    decodeScalar(location.query[PLATFORM_QUERY_PARAM]) ??
    localStorage.getItem(PLATFORM_LOCAL_STORAGE_KEY) ??
    DEFAULT_PLATFORM;

  return {
    project,
    selectedPlatform,
    isProjectCrossPlatform,
  };
}

export default useCrossPlatformProject;
