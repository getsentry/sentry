import {Organization} from 'sentry/types';
import {useProjectSdkUpdates} from 'sentry/utils/useProjectSdkUpdates';
import {semverCompare} from 'sentry/utils/versions';

type Opts = {
  minVersion: string;
  organization: Organization;
  projectId: string[];
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
    projectId: null,
  });

  if (sdkUpdates.type !== 'resolved') {
    return {isFetching: true, needsUpdate: undefined};
  }

  if (!sdkUpdates.data?.length) {
    return {isFetching: true, needsUpdate: undefined};
  }

  const selectedProjects = sdkUpdates.data.filter(sdkUpdate =>
    projectId.includes(sdkUpdate.projectId)
  );

  const needsUpdate =
    selectedProjects.length > 0 &&
    selectedProjects.every(
      sdkUpdate => semverCompare(sdkUpdate.sdkVersion || '', minVersion) === -1
    );

  return {isFetching: false, needsUpdate};
}

export default useProjectSdkNeedsUpdate;
