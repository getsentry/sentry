import type {AskSeerSearchQuery} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {
  buildSeerDateTimeSelection,
  type SeerDateTimeSelection,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/useSeerComboBoxSetup';
import type {PageFilters} from 'sentry/types/core';
import type {Sort} from 'sentry/utils/discover/fields';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import type {BaseVisualize} from 'sentry/views/explore/queryParams/visualize';

type SeerVisualization = AskSeerSearchQuery['visualizations'][number];

interface SeerExploreQuery {
  datetime: SeerDateTimeSelection;
  groupBys: string[];
  mode: Mode;
  query: string;
  sort: string;
  visualizes: BaseVisualize[];
  interval?: string;
}

function getSeerExploreMode(result: AskSeerSearchQuery): Mode {
  if ((result.groupBys?.length ?? 0) > 0 || result.mode === 'aggregates') {
    return Mode.AGGREGATE;
  }

  return Mode.SAMPLES;
}

function getSeerVisualizes(
  visualizations: readonly SeerVisualization[]
): BaseVisualize[] {
  return visualizations.map(({chartType, yAxes}) => ({
    chartType,
    yAxes,
  }));
}

// The chart uses a single interval (the `interval` URL param) shared across all
// y-axes, but Seer returns it per visualization. Use the first interval Seer
// provided.
function getSeerInterval(
  visualizations: readonly SeerVisualization[]
): string | undefined {
  return visualizations.find(({interval}) => Boolean(interval))?.interval ?? undefined;
}

export function getSeerExploreQuery({
  pageDatetime,
  result,
}: {
  pageDatetime: PageFilters['datetime'];
  result: AskSeerSearchQuery;
}): SeerExploreQuery {
  const datetime = buildSeerDateTimeSelection(
    result.start,
    result.end,
    result.statsPeriod,
    pageDatetime
  );

  return {
    datetime,
    groupBys: result.groupBys,
    mode: getSeerExploreMode(result),
    query: result.query,
    sort: result.sort,
    visualizes: getSeerVisualizes(result.visualizations),
    interval: getSeerInterval(result.visualizations),
  };
}

export function getSeerSort(sort: string): Sort | undefined {
  if (!sort) {
    return undefined;
  }

  if (sort.startsWith('-')) {
    return {field: sort.slice(1), kind: 'desc'};
  }

  return {field: sort, kind: 'asc'};
}
