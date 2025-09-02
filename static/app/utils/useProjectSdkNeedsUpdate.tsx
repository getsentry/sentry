import type {ProjectSdkUpdates} from 'sentry/types/project';
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
  | {isError: false; isFetching: true; needsUpdate: undefined}
  | {isError: true; isFetching: false; needsUpdate: undefined}
  | {isError: false; isFetching: false; needsUpdate: boolean} {
  const organization = useOrganization();

  const {data, isError, isPending} = useApiQuery<ProjectSdkUpdates[]>(
    [`/organizations/${organization.slug}/sdk-updates/`, {query: {project: projectId}}],
    {staleTime: Infinity, refetchOnMount: true}
  );

  if (isPending) {
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
