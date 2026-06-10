import type {AskSeerSearchQuery} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {
  buildSeerDateTimeSelection,
  type SeerDateTimeSelection,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/useSeerComboBoxSetup';
import type {PageFilters} from 'sentry/types/core';
import type {Sort} from 'sentry/utils/discover/fields';
import type {
  AggregateField,
  WritableAggregateField,
} from 'sentry/views/explore/queryParams/aggregateField';
import {isGroupBy} from 'sentry/views/explore/queryParams/groupBy';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {
  type BaseVisualize,
  isVisualize,
} from 'sentry/views/explore/queryParams/visualize';

type SeerVisualization = AskSeerSearchQuery['visualizations'][number];

interface SeerExploreQuery {
  datetime: SeerDateTimeSelection;
  groupBys: string[];
  mode: Mode;
  query: string;
  sort: string;
  visualizes: BaseVisualize[];
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

/**
 * Normalizes a raw Seer search result into the common shape the explore tabs
 * (logs, spans, metrics) apply to their query params. This is the first step
 * when applying a Seer "ask" result to the page.
 *
 * - `mode` is {@link Mode.AGGREGATE} when the result has any group bys or Seer
 *   explicitly returned `mode: 'aggregates'`, otherwise {@link Mode.SAMPLES}.
 * - `datetime` resolves the result's `start`/`end`/`statsPeriod` against the
 *   current page filter datetime, falling back to the page selection when Seer
 *   didn't return a time range.
 * - `query`, `sort`, and `groupBys` are passed through as-is; `visualizes` is
 *   stripped down to the writable `{chartType, yAxes}` shape.
 */
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
  };
}

/**
 * Parses the sort string returned by Seer (e.g. `-count(message)`) into a
 * {@link Sort} object. A leading `-` means descending, otherwise ascending.
 * Returns `undefined` for an empty string so callers can fall back to their
 * default sort.
 */
export function getSeerSort(sort: string): Sort | undefined {
  if (!sort) {
    return undefined;
  }

  if (sort.startsWith('-')) {
    return {field: sort.slice(1), kind: 'desc'};
  }

  return {field: sort, kind: 'asc'};
}

/**
 * Merges Seer's group bys and visualizes into the page's current aggregate
 * fields when applying an aggregate-mode result. `currentAggregateFields` is
 * only an ordering template: its group-by/visualize slots are filled in place
 * with the new values so the table/chart layout doesn't jump around, with
 * leftovers appended and extra slots dropped. If Seer returned no visualizes,
 * the current ones are kept, falling back to `fallbackVisualizes` (e.g. the
 * tab's default) so aggregate mode always has a y-axis.
 *
 * @returns Writable aggregate fields ready to be serialized into the URL.
 */
export function getSeerWritableAggregateFields({
  currentAggregateFields,
  fallbackVisualizes = [],
  groupBys,
  visualizes,
}: {
  currentAggregateFields: readonly AggregateField[];
  groupBys: readonly string[];
  visualizes: readonly BaseVisualize[];
  fallbackVisualizes?: readonly BaseVisualize[];
}): WritableAggregateField[] {
  const existingVisualizes = currentAggregateFields
    .filter(isVisualize)
    .map(visualize => visualize.serialize());
  const visualizesToUse = visualizes.length
    ? visualizes
    : existingVisualizes.length
      ? existingVisualizes
      : fallbackVisualizes;

  let seenVisualizes = false;
  let groupByAfterVisualizes = false;

  for (const aggregateField of currentAggregateFields) {
    if (isGroupBy(aggregateField) && seenVisualizes) {
      groupByAfterVisualizes = true;
      break;
    } else if (isVisualize(aggregateField)) {
      seenVisualizes = true;
    }
  }

  const aggregateFields: WritableAggregateField[] = [];
  const groupByIter = groupBys[Symbol.iterator]();
  const visualizeIter = visualizesToUse[Symbol.iterator]();
  let hasVisualizeSlot = false;

  for (const aggregateField of currentAggregateFields) {
    if (isVisualize(aggregateField)) {
      hasVisualizeSlot = true;
      if (!groupByAfterVisualizes) {
        for (const groupBy of groupByIter) {
          aggregateFields.push({groupBy});
        }
      }

      const {value: visualize, done} = visualizeIter.next();
      if (!done) {
        aggregateFields.push(visualize);
      }
    } else if (isGroupBy(aggregateField)) {
      const {value: groupBy, done} = groupByIter.next();
      if (!done) {
        aggregateFields.push({groupBy});
      }
    }
  }

  if (!hasVisualizeSlot) {
    for (const groupBy of groupByIter) {
      aggregateFields.push({groupBy});
    }
  }

  for (const visualize of visualizeIter) {
    aggregateFields.push(visualize);
  }

  for (const groupBy of groupByIter) {
    aggregateFields.push({groupBy});
  }

  return aggregateFields;
}
