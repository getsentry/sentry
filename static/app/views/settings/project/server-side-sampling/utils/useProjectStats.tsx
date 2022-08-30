import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';

export function useProjectStats() {
  const {projectStats30d, projectStats48h} = useLegacyStore(ServerSideSamplingStore);

  return {
    projectStats30d,
    projectStats48h,
  };
}
