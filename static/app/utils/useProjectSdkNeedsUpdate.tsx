import type {Organization} from 'sentry/types/organization';
import {useQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {semverCompare} from 'sentry/utils/versions/semverCompare';

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
  const path = `/organizations/${organization.slug}/sdk-updates/`;
  const api = useApi({persistInFlight: true});
  const {data, isPending, isError} = useQuery({
    queryKey: [path],
    queryFn: async () => {
      try {
        return await api.requestPromise(path, {
          method: 'GET',
        });
      } catch {
        return [];
      }
    },
    staleTime: 5000,
    refetchOnMount: false,
  });

  if (isPending) {
    return {isError: false, isFetching: true, needsUpdate: undefined};
  }

  if (isError) {
    return {isError: true, isFetching: false, needsUpdate: undefined};
  }

  const selectedProjects = data.filter((sdkUpdate: any) =>
    projectId.includes(sdkUpdate.projectId)
  );

  const needsUpdate =
    selectedProjects.length > 0 &&
    selectedProjects.every(
      (sdkUpdate: any) => semverCompare(sdkUpdate.sdkVersion || '', minVersion) === -1
    );

  return {
    isError: false,
    isFetching: false,
    needsUpdate,
  };
}

export default useProjectSdkNeedsUpdate;
