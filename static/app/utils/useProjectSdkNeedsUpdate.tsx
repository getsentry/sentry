import {Organization} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {semverCompare} from 'sentry/utils/versions';

import {ProjectSdkUpdates} from '../types/project';

type Opts = {
  minVersion: string;
  organization: Organization;
  projectId: string[];
};

function useProjectSdkNeedsUpdate({
  minVersion,
  organization,
  projectId,
}: Opts):
  | {isError: false; isFetching: true; needsUpdate: undefined}
  | {isError: true; isFetching: false; needsUpdate: undefined}
  | {isError: false; isFetching: false; needsUpdate: boolean} {
  const {data, isLoading, isError} = useApiQuery<ProjectSdkUpdates[]>(
    [`/organizations/${organization.slug}/sdk-updates/`],
    {staleTime: 5000}
  );

  if (isLoading) {
    return {isError: false, isFetching: true, needsUpdate: undefined};
  }

  if (isError) {
    return {isError: true, isFetching: false, needsUpdate: undefined};
  }

  const selectedProjects = data.filter(sdkUpdate =>
    projectId.includes(sdkUpdate.projectId)
  );

  const needsUpdate =
    selectedProjects.length > 0 &&
    selectedProjects.every(
      sdkUpdate => semverCompare(sdkUpdate.sdkVersion || '', minVersion) === -1
    );

  return {
    isError: false,
    isFetching: false,
    needsUpdate,
  };
}

export default useProjectSdkNeedsUpdate;
