import {useQuery, UseQueryOptions} from '@tanstack/react-query';

import {ResponseMeta} from 'sentry/api';
import {t} from 'sentry/locale';
import {Organization, SeriesApi} from 'sentry/types';
import handleXhrErrorResponse from 'sentry/utils/handleXhrErrorResponse';
import useApi from 'sentry/utils/useApi';

type Props = {
  organizationSlug: Organization['slug'];
  /**
   * Can be used to configure how the query is fetched, cached, etc
   */
  queryOptions?: UseQueryOptions<SeriesApi>;
  /**
   * Query parameters to add to the requested URL
   */
  queryParameters?: Record<string, any>;
};

// Fetches the organization stats
export function useOrganizationStats({
  organizationSlug,
  queryOptions,
  queryParameters,
}: Props) {
  const api = useApi();

  const organizationStats = useQuery<SeriesApi>(
    ['organizationStats', organizationSlug, queryParameters],
    async (): Promise<SeriesApi> =>
      await api.requestPromise(`/organizations/${organizationSlug}/stats_v2/`, {
        query: queryParameters,
      }),
    {
      // refetchOnMount defaults to false as this hook can be used on different components on the same page and
      // we generally don't want to refetch the data in each component mount.
      refetchOnMount: false,
      onError: error => {
        const errorMessage = t('Unable to fetch organization stats');
        handleXhrErrorResponse(errorMessage)(error as ResponseMeta);
      },
      ...queryOptions,
    }
  );

  return organizationStats;
}
