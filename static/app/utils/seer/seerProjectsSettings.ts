import {mutationOptions, type QueryClient} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {encodeSort} from 'sentry/utils/discover/eventView';
import type {Sort} from 'sentry/utils/discover/fields';
import {fetchMutation} from 'sentry/utils/queryClient';
import type {
  SeerProjectSetting,
  SeerProjectSettingResponse,
} from 'sentry/utils/seer/types';

export function getInfiniteSeerProjectsSettingsQueryOptions({
  organization,
  query,
}: {
  organization: Organization;
  query: {
    cursor?: string;
    per_page?: number;
    sort?: Sort;
  };
}) {
  const {cursor, per_page = 100, sort} = query;
  const sortQuery = sort ? encodeSort(sort) : undefined;
  return apiOptions.asInfinite<SeerProjectSettingResponse[]>()(
    '/organizations/$organizationIdOrSlug/seer/projects/',
    {
      path: {organizationIdOrSlug: organization.slug},
      query: {per_page, sort: sortQuery, cursor},
      staleTime: 60_000, // 1 minute
    }
  );
}

export function getMutateSeerProjectsSettingsOptions({
  organization,
  queryClient,
}: {
  organization: Organization;
  queryClient: QueryClient;
}) {
  const queryKey = getInfiniteSeerProjectsSettingsQueryOptions({
    organization,
    query: {},
  }).queryKey;
  const [url] = queryKey;

  return mutationOptions({
    mutationFn: (data: Partial<SeerProjectSetting>) => {
      return fetchMutation({
        method: 'PUT',
        url,
        data,
      });
    },
    onMutate: async _data => {
      await queryClient.cancelQueries({queryKey: [url]});
      const previousData = queryClient.getQueryData(queryKey);

      // TODO: Optimistically update the query cache? We need to convert some
      // values, if we have them
      //
      // queryClient.setQueryData(
      //   queryKey,
      //   (prev: ApiResponse<SeerProjectSettingsResponse> | undefined) =>
      //     prev
      //       ? {...prev, json: {...prev.json, ...data}}
      //       : {headers: {}, json: {...(data as SeerProjectSettingsResponse)}}
      // );

      return {previousData};
    },
    onError: (_error, _data, context) => {
      queryClient.setQueryData(queryKey, context?.previousData);
    },
    onSettled: () => {
      queryClient.invalidateQueries({queryKey});
    },
  });
}
