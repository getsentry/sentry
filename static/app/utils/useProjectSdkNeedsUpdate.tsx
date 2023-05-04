import {Organization} from 'sentry/types';
import {useProjectSdkUpdates} from 'sentry/utils/useProjectSdkUpdates';
import {semverCompare} from 'sentry/utils/versions';

type Opts = {
  minVersion: string;
  organization: Organization;
  projectId: string;
};

function useProjectSdkNeedsUpdate({minVersion, organization, projectId}: Opts):
  | {
      isFetching: true;
      needsUpdate: undefined;
    }
  | {
      isFetching: false;
      needsUpdate: boolean;
    } {
  const sdkUpdates = useProjectSdkUpdates({
    organization,
    projectId,
  });

  if (sdkUpdates.type !== 'resolved') {
    return {isFetching: true, needsUpdate: undefined};
  }

  if (!sdkUpdates.data?.sdkVersion) {
    return {isFetching: true, needsUpdate: undefined};
  }

  const needsUpdate = semverCompare(sdkUpdates.data?.sdkVersion || '', minVersion) === -1;
  return {isFetching: false, needsUpdate};
}

export default useProjectSdkNeedsUpdate;
