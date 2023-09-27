import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import {ProjectSdkUpdates} from '../types/project';

interface Options {
  enabled?: boolean;
  projectId?: string[];
}

export function useOrganizationSDKUpdates({projectId, enabled}: Options): {
  isError: boolean;
  isFetching: boolean;
  data?: ProjectSdkUpdates[];
} {
  const organization = useOrganization();

  return useApiQuery<ProjectSdkUpdates[]>(
    [`/organizations/${organization.slug}/sdk-updates/`, {query: {project: projectId}}],
    {staleTime: 5000, enabled}
  );
}
