import type {Location} from 'history';
import * as qs from 'query-string';

import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Confidence} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {newExploreTarget} from 'sentry/views/explore/contexts/pageParamsContext';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';

export function getExploreUrl({
  orgSlug,
  selection,
  interval,
  mode,
  visualize,
  query,
  groupBy,
  sort,
  field,
}: {
  interval: string;
  orgSlug: string;
  selection: PageFilters;
  visualize: Omit<Visualize, 'label'>[];
  field?: string[];
  groupBy?: string[];
  mode?: Mode;
  query?: string;
  sort?: string;
}) {
  const {start, end, period: statsPeriod, utc} = selection.datetime;
  const {environments, projects} = selection;
  const queryParams = {
    dataset: DiscoverDatasets.SPANS_EAP_RPC,
    project: projects,
    environment: environments,
    statsPeriod,
    start,
    end,
    interval,
    mode,
    query,
    visualize: visualize.map(v => JSON.stringify(v)),
    groupBy,
    sort,
    field,
    utc,
  };
  return normalizeUrl(
    `/organizations/${orgSlug}/traces/?${qs.stringify(queryParams, {skipNull: true})}`
  );
}

export function combineConfidenceForSeries(series: Series[]): Confidence {
  let lows = 0;
  let highs = 0;
  let nulls = 0;

  for (const s of series) {
    if (s.confidence === 'low') {
      lows += 1;
    } else if (s.confidence === 'high') {
      highs += 1;
    } else {
      nulls += 1;
    }
  }

  if (lows <= 0 && highs <= 0 && nulls >= 0) {
    return null;
  }

  if (lows / (lows + highs) > 0.5) {
    return 'low';
  }

  return 'high';
}

export function viewSamplesTarget(
  location: Location,
  query: string,
  groupBys: string[],
  row: Record<string, any>,
  extras: {
    // needed to generate targets when `project` is in the group by
    projects: Project[];
  }
) {
  const search = new MutableSearch(query);

  for (const groupBy of groupBys) {
    const value = row[groupBy];
    if (groupBy === 'project' && typeof value === 'string') {
      const project = extras.projects.find(p => p.slug === value);
      if (defined(project)) {
        location.query.project = project.id;
      }
    } else if (groupBy === 'project.id' && typeof value === 'number') {
      location.query.project = String(value);
    } else if (groupBy === 'environment' && typeof value === 'string') {
      location.query.environment = value;
    } else if (typeof value === 'string') {
      search.setFilterValues(groupBy, [value]);
    }
  }

  return newExploreTarget(location, {
    mode: Mode.SAMPLES,
    query: search.formatString(),
  });
}
