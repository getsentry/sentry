import isArray from 'lodash/isArray';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import {STARFISH_PROJECT_KEY} from 'sentry/views/starfish/utils/constants';

export function useStarfishProject(): [string, (value: string) => void] {
  const [selectedProjectId, setSelectedProjectId] = useLocalStorageState(
    STARFISH_PROJECT_KEY,
    '1'
  );

  // Prioritize the URL first -- check if there is a project provided via query params before using localstorage
  const location = useLocation();
  if ('project' in location.query) {
    const projectQueryParam = location.query.project;
    const projectId = isArray(projectQueryParam)
      ? projectQueryParam[0]
      : projectQueryParam;
    return [projectId ?? '1', setSelectedProjectId];
  }

  return [selectedProjectId, setSelectedProjectId];
}
