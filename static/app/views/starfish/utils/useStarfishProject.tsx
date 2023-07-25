import isArray from 'lodash/isArray';
import {defined} from 'sentry/utils';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {ALLOWED_PROJECT_IDS_FOR_ORG_SLUG} from 'sentry/views/starfish/allowedProjects';
import {STARFISH_PROJECT_KEY} from 'sentry/views/starfish/utils/constants';

export function useStarfishProject(): [string, (value: string) => void] {
  const [selectedProjectId, setSelectedProjectId] = useLocalStorageState(
    STARFISH_PROJECT_KEY,
    '1'
  );

  // Check if the project in the URL is allowed. If it's not, select the default project and update the URL
  const organization = useOrganization();
  const router = useRouter();
  const location = useLocation();
  const allowedProjectIDs: string[] =
    ALLOWED_PROJECT_IDS_FOR_ORG_SLUG[organization.slug] ?? [];

  console.dir(location);

  // Prioritize the URL first -- check if there is a project provided via query params before using localstorage
  if ('project' in location.query) {
    const projectQueryParam = location.query.project;

    const projectId = isArray(projectQueryParam)
      ? projectQueryParam[0]
      : projectQueryParam;

    // If the URL contains one of the allowed projects, return it. Otherwise, return the first allowed project and update the URL
    if (defined(projectId) && allowedProjectIDs.includes(projectId)) {
      return [projectId, setSelectedProjectId];
    }

    router.replace({
      ...location,
      query: {...location.query, project: allowedProjectIDs[0]},
    });
    return [allowedProjectIDs[0], setSelectedProjectId];
  }

  return [selectedProjectId, setSelectedProjectId];
}
