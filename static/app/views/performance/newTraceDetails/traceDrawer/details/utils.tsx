import type {Location} from 'history';

import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';

export function getProfileMeta(event: EventTransaction | null) {
  const profileId = event?.contexts?.profile?.profile_id;
  if (profileId) {
    return profileId;
  }
  const profilerId = event?.contexts?.profile?.profiler_id;
  if (profilerId) {
    const start = new Date(event.startTimestamp * 1000);
    const end = new Date(event.endTimestamp * 1000);
    return {
      profiler_id: profilerId,
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }
  return null;
}

export enum CellActionKind {
  INCLUDE = 'include',
  EXCLUDE = 'exclude',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
}

export function getSearchInExploreTarget(
  organization: Organization,
  location: Location,
  key: string,
  value: string,
  kind: CellActionKind
) {
  const {start, end, statsPeriod} = normalizeDateTimeParams(location.query);
  const search = new MutableSearch('');

  if (kind === CellActionKind.INCLUDE) {
    search.setFilterValues(key, [value]);
  } else if (kind === CellActionKind.EXCLUDE) {
    search.setFilterValues(`!${key}`, [`${value}`]);
  } else if (kind === CellActionKind.GREATER_THAN) {
    search.setFilterValues(key, [`>${value}`]);
  } else {
    search.setFilterValues(key, [`<${value}`]);
  }

  return {
    pathname: normalizeUrl(`/organizations/${organization.slug}/traces/`),
    query: {
      start,
      end,
      statsPeriod,
      query: search.formatString(),
    },
  };
}
