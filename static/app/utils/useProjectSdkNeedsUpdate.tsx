import type {ProjectSdkUpdates} from 'sentry/types/project';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {semverCompare} from 'sentry/utils/versions/semverCompare';

type Opts = {
  minVersion: string;
  projectId: string[];
};

export default function useProjectSdkNeedsUpdate({
  minVersion,
  projectId,
}: Opts):
  | {data: undefined; isError: false; isFetching: true; needsUpdate: undefined}
  | {data: undefined; isError: true; isFetching: false; needsUpdate: undefined}
  | {data: ProjectSdkUpdates[]; isError: false; isFetching: false; needsUpdate: boolean} {
  const organization = useOrganization();

  const {data, isError, isPending} = useApiQuery<ProjectSdkUpdates[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/sdk-updates/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {
        query: {project: projectId},
      },
    ],
    {staleTime: Infinity, refetchOnMount: true}
  );

  if (isPending) {
    return {isError: false, isFetching: true, needsUpdate: undefined, data: undefined};
  }
  if (isError) {
    return {isError: true, isFetching: false, needsUpdate: undefined, data: undefined};
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
    data: selectedProjects,
  };
}
