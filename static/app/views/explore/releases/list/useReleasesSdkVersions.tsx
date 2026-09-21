import {skipToken, useQuery} from '@tanstack/react-query';
import pick from 'lodash/pick';

import {URL_PARAM} from 'sentry/components/pageFilters/constants';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {Organization} from 'sentry/types/organization';
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
  release: string;
  'sdk.name': string;
  'sdk.version': string;
};

export function useReleasesSdkVersions(organization: Organization, versions: string[]) {
  const location = useLocation();

  const search = new MutableSearch('has:sdk.version');
  search.addDisjunctionFilterValues('release', versions);

  return useQuery({
    ...apiOptions.as<{data: SdkVersionRow[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path: versions.length ? {organizationIdOrSlug: organization.slug} : skipToken,
        query: {
          referrer: 'api.releases.releases-list-sdk-versions',
          dataset: DiscoverDatasets.ERRORS,
          field: ['release', 'sdk.name', 'sdk.version', 'count()'],
          query: search.formatString(),
          sort: '-count()',
          per_page: 100,
          ...normalizeDateTimeParams(pick(location.query, Object.values(URL_PARAM))),
        },
        staleTime: 0,
      }
    ),
    select: response => {
      const byRelease = new Map<string, ReleaseSdkVersion[]>();
      for (const row of response.json.data) {
        const sdks = byRelease.get(row.release) ?? [];
        sdks.push({
          count: row['count()'],
          name: row['sdk.name'],
          version: row['sdk.version'],
        });
        byRelease.set(row.release, sdks);
      }
      return byRelease;
    },
  });
}
