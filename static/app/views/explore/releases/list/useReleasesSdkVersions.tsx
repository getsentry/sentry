import {useCallback} from 'react';
import {skipToken, useQuery} from '@tanstack/react-query';
import pick from 'lodash/pick';
import uniq from 'lodash/uniq';

import {URL_PARAM} from 'sentry/components/pageFilters/constants';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {Organization} from 'sentry/types/organization';
import type {Release} from 'sentry/types/release';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';

export type ReleaseSdkVersion = {
  count: number;
  name: string;
  version: string;
};

type SdkVersionRow = {
  'count()': number;
  'project.id': number;
  release: string;
  'sdk.name': string;
  'sdk.version': string;
};

function getKey(projectId: number | string, version: string) {
  return `${projectId}:${version}`;
}

export function useReleasesSdkVersions(organization: Organization, releases: Release[]) {
  const location = useLocation();
  const versions = uniq(releases.map(release => release.version));

  const search = new MutableSearch('has:sdk.version');
  search.addDisjunctionFilterValues('release', versions);

  const {data: rowsByKey} = useQuery({
    ...apiOptions.as<{data: SdkVersionRow[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: versions.length ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          referrer: 'api.releases.releases-list-sdk-versions',
          dataset: DiscoverDatasets.ERRORS,
          field: ['project.id', 'release', 'sdk.name', 'sdk.version', 'count()'],
          query: search.formatString(),
          sort: '-count()',
          per_page: 100,
          ...normalizeDateTimeParams(pick(location.query, Object.values(URL_PARAM))),
        },
        staleTime: 0,
      }
    ),
    select: response =>
      Map.groupBy(response.json.data, row => getKey(row['project.id'], row.release)),
  });

  return useCallback(
    (release: Release): ReleaseSdkVersion[] => {
      const counts = new Map<string, ReleaseSdkVersion>();
      for (const project of release.projects) {
        for (const row of rowsByKey?.get(getKey(project.id, release.version)) ?? []) {
          const key = `${row['sdk.name']}@${row['sdk.version']}`;
          const existing = counts.get(key);
          counts.set(key, {
            count: (existing?.count ?? 0) + row['count()'],
            name: row['sdk.name'],
            version: row['sdk.version'],
          });
        }
      }
      return [...counts.values()].sort((a, b) => b.count - a.count);
    },
    [rowsByKey]
  );
}
