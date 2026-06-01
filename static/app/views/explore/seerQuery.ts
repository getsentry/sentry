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
  Visualize,
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

export function getSeerSort(sort: string): Sort | undefined {
  if (!sort) {
    return undefined;
  }

  if (sort.startsWith('-')) {
    return {field: sort.slice(1), kind: 'desc'};
  }

  return {field: sort, kind: 'asc'};
}

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

export function getSeerAggregateFields({
  currentAggregateFields,
  fallbackVisualizes,
  groupBys,
  visualizes,
}: {
  currentAggregateFields: readonly AggregateField[];
  groupBys: readonly string[];
  visualizes: readonly BaseVisualize[];
  fallbackVisualizes?: readonly BaseVisualize[];
}): AggregateField[] {
  const aggregateFields: AggregateField[] = [];
  const writableFields = getSeerWritableAggregateFields({
    currentAggregateFields,
    fallbackVisualizes,
    groupBys,
    visualizes,
  });

  for (const field of writableFields) {
    if ('groupBy' in field) {
      aggregateFields.push(field);
    } else {
      aggregateFields.push(...Visualize.fromJSON(field));
    }
  }

  return aggregateFields;
}
