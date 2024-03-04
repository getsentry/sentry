import {useCallback, useEffect, useMemo} from 'react';

import type {ApiResult} from 'sentry/api';
import type {Project} from 'sentry/types';
import useAggregatedQueryKeys from 'sentry/utils/api/useAggregatedQueryKeys';
import useAllProjectsVisibility from 'sentry/utils/project/useAllProjectVisibility';
import type {ApiQueryKey} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

type Props = {slug: string; id?: undefined} | {id: string; slug?: undefined};

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
  const organiation = useOrganization();
  const {bySlug} = useAllProjectsVisibility({});

  const getQueryKey = useCallback(
    (ids: readonly AggQueryKey[]): ApiQueryKey => [
      `/organizations/${organiation.slug}/projects/`,
      {
        query: {
          query: ids.join(' '),
        },
      },
    ],
    [organiation.slug]
  );

  const byIdCache = useAggregatedQueryKeys<AggQueryKey, ProjectStore>({
    cacheKey: `/organizations/${organiation.slug}/projects/#project-by-id`,
    bufferLimit: 5,
    getQueryKey,
    responseReducer: useMemo(() => makeResponseReducer('id'), []),
  });

  const bySlugCache = useAggregatedQueryKeys<AggQueryKey, ProjectStore>({
    cacheKey: `/organizations/${organiation.slug}/projects/#project-by-slug`,
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
        const lookupId = bySlug[slug]?.id;
        if (lookupId) {
          byIdCache.buffer([`id:${lookupId}`]);
        } else if (slug) {
          bySlugCache.buffer([`slug:${slug}`]);
        }
      }
    }
  }, [id, slug, byIdCache, bySlug, bySlugCache]);

  const lookupId = id ?? bySlug[slug]?.id ?? slug;
  return byIdCache.data?.[lookupId] ?? bySlugCache.data?.[lookupId];
}
