import {useQueries} from '@tanstack/react-query';

import {ResponseMeta} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization, Project, SeriesApi} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

type Props = {
  hasAccess: boolean;
  organizationSlug: Organization['slug'];
  projectId: Project['id'];
};

export function useProjectStats({organizationSlug, projectId, hasAccess}: Props) {
  const api = useApi();

  const [projectStats48h, projectStats30d] = useQueries({
    queries: [
      {
        queryKey: ['projectStats48h', organizationSlug, projectId],
        queryFn: async (): Promise<SeriesApi> => {
          return await api.requestPromise(
            `/organizations/${organizationSlug}/stats_v2/`,
            {
              query: {
                project: projectId,
                category: 'transaction',
                field: 'sum(quantity)',
                interval: '1h',
                statsPeriod: '48h',
                groupBy: 'outcome',
              },
            }
          );
        },
        onError: (error: unknown) => {
          const errorMessage = t('Unable to fetch project stats from the last 48 hours');
          handleXhrErrorResponse(errorMessage)(error as ResponseMeta);
        },
        refetchOnMount: false, // This hook is being used on different components on the same page and we don't want to refetch the data on every component mount.
        enabled: hasAccess,
      },
      {
        queryKey: ['projectStats30d', organizationSlug, projectId],
        queryFn: async (): Promise<SeriesApi> => {
          return await api.requestPromise(
            `/organizations/${organizationSlug}/stats_v2/`,
            {
              query: {
                project: projectId,
                category: 'transaction',
                field: 'sum(quantity)',
                interval: '1d',
                statsPeriod: '30d',
                groupBy: ['outcome', 'reason'],
              },
            }
          );
        },
        onError: (error: unknown) => {
          const errorMessage = t('Unable to fetch project stats from the last 30 days');
          handleXhrErrorResponse(errorMessage)(error as ResponseMeta);
        },
        refetchOnMount: false, // This hook is being used on different components on the same page and we don't want to refetch the data on every component mount.
        enabled: hasAccess,
      },
    ],
  });

  function handleRefetch() {
    projectStats48h.refetch();
    projectStats30d.refetch();
  }

  return {
    projectStats30d: {
      loading: projectStats30d.isLoading,
      error: projectStats30d.isError,
      data: projectStats30d.data,
    },
    projectStats48h: {
      loading: projectStats48h.isLoading,
      error: projectStats48h.isError,
      data: projectStats48h.data,
    },
    onRefetch: handleRefetch,
  };
}
