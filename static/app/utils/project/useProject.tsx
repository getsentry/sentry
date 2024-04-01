import {useCallback, useEffect, useMemo} from 'react';

import type {ApiResult} from 'sentry/api';
import type {Project} from 'sentry/types';
import useAggregatedQueryKeys from 'sentry/utils/api/useAggregatedQueryKeys';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type Props =
  | {slug: string | undefined; id?: never}
  | {id: string | undefined; slug?: never};

type AggQueryKey = string;

type ProjectStore = Record<string, Project>;

function makeResponseReducer(fieldName: string) {
  return (
    prevState: undefined | ProjectStore,
    response: ApiResult,
    _aggregates: readonly AggQueryKey[]
  ) => ({
    ...prevState,
    ...Object.fromEntries(response[0].map(project => [project[fieldName], project])),
  });
}

export default function useProject({slug, id}: Props) {
  const organization = useOrganization();

  const getQueryKey = useCallback(
    (ids: readonly AggQueryKey[]): ApiQueryKey => [
      `/organizations/${organization.slug}/projects/`,
      {
        query: {
          query: ids.join(' '),
        },
      },
    ],
    [organization.slug]
  );

  const byIdCache = useAggregatedQueryKeys<AggQueryKey, ProjectStore>({
    cacheKey: `/organizations/${organization.slug}/projects/#project-by-id`,
    bufferLimit: 5,
    getQueryKey,
    responseReducer: useMemo(() => makeResponseReducer('id'), []),
  });

  const bySlugCache = useAggregatedQueryKeys<AggQueryKey, ProjectStore>({
    cacheKey: `/organizations/${organization.slug}/projects/#project-by-slug`,
    bufferLimit: 5,
    getQueryKey,
    responseReducer: useMemo(() => makeResponseReducer('slug'), []),
  });

  useEffect(() => {
    if (id) {
      byIdCache.buffer([`id:${id}`]);
    } else if (slug) {
      if (bySlugCache.data?.[slug]) {
        bySlugCache.buffer([`slug:${slug}`]);
      } else {
        bySlugCache.buffer([`slug:${slug}`]);
      }
    }
  }, [id, slug, byIdCache, bySlugCache]);

  const lookupId = id ?? slug;
  return lookupId
    ? byIdCache.data?.[lookupId] ?? bySlugCache.data?.[lookupId]
    : undefined;
}
