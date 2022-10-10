import {useQuery} from '@tanstack/react-query';

import {ResponseMeta} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import {SamplingDistribution, SamplingSdkVersion} from 'sentry/types/sampling';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

type Props = {
  hasAccess: boolean;
  organizationSlug: Organization['slug'];
  projectId: Project['id'];
  distribution?: SamplingDistribution;
};

export function useSdkVersions({
  hasAccess,
  distribution,
  organizationSlug,
  projectId,
}: Props) {
  const api = useApi();

  const projectIds = [
    projectId,
    ...(distribution?.projectBreakdown?.map(
      projectBreakdown => projectBreakdown.project_id
    ) ?? []),
  ];

  const samplingSdkVersions = useQuery(
    [
      'samplingSdkVersions',
      organizationSlug,
      projectIds,
      distribution?.startTimestamp,
      distribution?.endTimestamp,
    ],
    async (): Promise<SamplingSdkVersion[]> =>
      await api.requestPromise(
        `/organizations/${organizationSlug}/dynamic-sampling/sdk-versions/`,
        {
          query: {
            project: projectIds,
            start: distribution?.startTimestamp,
            end: distribution?.endTimestamp,
          },
        }
      ),
    {
      refetchOnMount: false, // This hook is being used on different components on the same page and we don't want to refetch the data on every component mount.
      enabled: !!distribution && hasAccess, // only fetches if distribution is available and user has access.
      onError: error => {
        const errorMessage = t('Unable to fetch sampling SDK versions');
        handleXhrErrorResponse(errorMessage)(error as ResponseMeta);
      },
    }
  );

  return {
    loading: samplingSdkVersions.isLoading,
    error: samplingSdkVersions.isError,
    data: samplingSdkVersions.data,
  };
}
