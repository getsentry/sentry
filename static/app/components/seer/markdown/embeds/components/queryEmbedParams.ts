import type {PageFilters} from 'sentry/types/core';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import type {BaseVisualize} from 'sentry/views/explore/queryParams/visualize';

interface PageFilterParams {
  end?: string;
  environments?: string[];
  projects?: Array<string | number>;
  start?: string;
  statsPeriod?: string;
}

/**
 * Project IDs may arrive as strings or numbers. URL builders take the numeric
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
  transformations,
}: {
  groupBy?: string[];
  transformations?: ReadonlyArray<readonly string[]>;
  yAxes?: string[];
}): Array<{groupBy: string} | BaseVisualize> | undefined {
  const visualizes = transformations?.some(pipeline => pipeline.length)
    ? (yAxes ?? []).map((yAxis, index) =>
        new VisualizeFunction(yAxis, {
          transformations: transformations[index],
        }).serialize()
      )
    : yAxes?.length
      ? [{yAxes}]
      : [];
  const fields = [...(groupBy ?? []).map(field => ({groupBy: field})), ...visualizes];
  return fields.length > 0 ? fields : undefined;
}
