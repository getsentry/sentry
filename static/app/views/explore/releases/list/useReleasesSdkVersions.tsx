import {useMemo} from 'react';
import {useInfiniteQuery, type InfiniteData} from '@tanstack/react-query';
import uniq from 'lodash/uniq';

import {MAX_PICKABLE_DAYS} from 'sentry/constants';
import type {PageFilters} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import {useFetchAllPages, type ApiResponse} from 'sentry/utils/api/apiFetch';
import {
  mergeSdkVersionRows,
  releaseSdkVersionsApiOptions,
  selectSdkVersionRows,
  type ReleaseSdkVersion,
  type SdkVersionRow,
} from 'sentry/views/explore/releases/utils/releaseSdkVersionsApiOptions';

function getRowKey(projectId: number | string, version: string) {
  return `${projectId}:${version}`;
}

function selectRowsByKey(data: InfiniteData<ApiResponse<{data: SdkVersionRow[]}>>) {
  return Map.groupBy(selectSdkVersionRows(data), row =>
    getRowKey(row['project.id'], row.release)
  );
}

interface Params {
  enabled: boolean;
  organization: Organization;
  releases: Release[];
  selection: PageFilters;
}

export function useReleasesSdkVersions({
  enabled,
  organization,
  releases,
  selection,
}: Params) {
  const options = releaseSdkVersionsApiOptions({
    organization,
    // The releases list isn't scoped to the page's date range, so look back over
    // the whole retention window rather than just the selected period.
    pageFilterParams: {
      project: selection.projects,
      environment: selection.environments,
      statsPeriod: `${MAX_PICKABLE_DAYS}d`,
    },
    referrer: 'api.releases.releases-list-sdk-versions',
    versions: uniq(releases.map(release => release.version)),
  });

  const result = useInfiniteQuery({
    ...options,
    enabled: enabled && options.enabled,
    select: selectRowsByKey,
  });
  useFetchAllPages({result});
  const rowsByKey = result.data;

  return useMemo(
    () =>
      new Map<Release, ReleaseSdkVersion[]>(
        releases.map(release => [
          release,
          mergeSdkVersionRows(
            release.projects.flatMap(
              project => rowsByKey?.get(getRowKey(project.id, release.version)) ?? []
            )
          ),
        ])
      ),
    [releases, rowsByKey]
  );
}
