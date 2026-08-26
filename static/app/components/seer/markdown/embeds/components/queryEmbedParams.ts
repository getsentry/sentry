import type {PageFilters} from 'sentry/types/core';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';

interface PageFilterParams {
  end?: string;
  environments?: string[];
  projects?: string[];
  start?: string;
  statsPeriod?: string;
}

/**
 * Seer reports project IDs as strings, but the URL builders take the numeric
 * `PageFilters` shape. An empty project list is meaningful rather than absent:
 * the builders encode it as the "My Projects" selection.
 */
export function toPageFilters({
  projects,
  environments,
  statsPeriod,
  start,
  end,
}: PageFilterParams): PageFilters {
  return {
    projects: projects?.map(Number).filter(Number.isInteger) ?? [],
    environments: environments ?? [],
    datetime: {
      period: statsPeriod ?? null,
      start: start ?? null,
      end: end ?? null,
      utc: null,
    },
  };
}

export function toMode(mode: 'samples' | 'aggregate'): Mode {
  return mode === 'aggregate' ? Mode.AGGREGATE : Mode.SAMPLES;
}

/**
 * Explore flattens group-bys and chart aggregates into a single ordered
 * `aggregateField` list. The object literals structurally match the `GroupBy`
 * and `BaseVisualize` types each Explore surface declares for itself.
 */
export function toAggregateFields({
  groupBy,
  yAxes,
}: {
  groupBy?: string[];
  yAxes?: string[];
}): Array<{groupBy: string} | {yAxes: string[]}> | undefined {
  const fields = [
    ...(groupBy ?? []).map(field => ({groupBy: field})),
    ...(yAxes?.length ? [{yAxes}] : []),
  ];
  return fields.length > 0 ? fields : undefined;
}
