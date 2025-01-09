import * as qs from 'query-string';

import type {PageFilters} from 'sentry/types/core';
import type {Series} from 'sentry/types/echarts';
import type {Confidence} from 'sentry/types/organization';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import type {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
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
