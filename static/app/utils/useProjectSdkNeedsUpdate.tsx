import {Organization} from 'sentry/types';
import {useProjectSdkUpdates} from 'sentry/utils/useProjectSdkUpdates';
import {semverCompare} from 'sentry/utils/versions';

type Opts = {
  minVersion: string;
  organization: Organization;
  projectId: string;
};

function useProjectSdkNeedsUpdate({
  minVersion,
  organization,
  projectId,
}: Opts): boolean | undefined {
  const sdkUpdates = useProjectSdkUpdates({
    organization,
    projectId,
  });

  if (sdkUpdates.type !== 'resolved') {
    return undefined;
  }

  if (!sdkUpdates.data?.sdkVersion) {
    return undefined;
  }

  const needsUpdate = semverCompare(sdkUpdates.data?.sdkVersion || '', minVersion) === -1;
  return needsUpdate;
}

export default useProjectSdkNeedsUpdate;
