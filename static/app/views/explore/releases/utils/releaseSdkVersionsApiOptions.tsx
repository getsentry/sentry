import {skipToken, type InfiniteData} from '@tanstack/react-query';

import type {Organization} from 'sentry/types/organization';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';

export type ReleaseSdkVersion = {
  count: number;
  name: string;
  version: string;
};

export type SdkVersionRow = {
  'count()': number;
  'project.id': number;
  release: string;
  'sdk.name': string;
  'sdk.version': string;
};

interface Params {
  organization: Organization;
  pageFilterParams: Record<string, unknown>;
  referrer: string;
  versions: string[];
}

export function releaseSdkVersionsApiOptions({
  organization,
  pageFilterParams,
  referrer,
  versions,
}: Params) {
  const search = new MutableSearch('has:sdk.version');
  search.addDisjunctionFilterValues('release', versions);

  return apiOptions.asInfinite<{data: SdkVersionRow[]}>()(
    '/organizations/$organizationIdOrSlug/events/',
    {
      path: versions.length ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: {
        ...pageFilterParams,
        referrer,
        dataset: DiscoverDatasets.ERRORS,
        field: ['project.id', 'release', 'sdk.name', 'sdk.version', 'count()'],
        query: search.formatString(),
        sort: '-count()',
        per_page: 100,
      },
      staleTime: 60_000,
    }
  );
}

export function selectSdkVersionRows(
  data: InfiniteData<ApiResponse<{data: SdkVersionRow[]}>>
) {
  return data.pages.flatMap(page => page.json.data);
}

export function getSdkVersionKey(sdk: Pick<ReleaseSdkVersion, 'name' | 'version'>) {
  return `${sdk.name}@${sdk.version}`;
}

export function mergeSdkVersionRows(rows: SdkVersionRow[]): ReleaseSdkVersion[] {
  const merged = new Map<string, ReleaseSdkVersion>();
  for (const row of rows) {
    const sdk = {name: row['sdk.name'], version: row['sdk.version']};
    const key = getSdkVersionKey(sdk);
    merged.set(key, {...sdk, count: (merged.get(key)?.count ?? 0) + row['count()']});
  }
  return [...merged.values()].sort((a, b) => b.count - a.count);
}
