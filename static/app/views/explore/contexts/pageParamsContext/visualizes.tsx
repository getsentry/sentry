import type {Location} from 'history';

import {Expression} from 'sentry/components/arithmeticBuilder/expression';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {parseFunction} from 'sentry/utils/discover/fields';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  ALLOWED_EXPLORE_VISUALIZE_FIELDS,
} from 'sentry/utils/fields';
import {decodeList} from 'sentry/utils/queryString';
import {ChartType} from 'sentry/views/insights/common/components/chart';

export const MAX_VISUALIZES = 4;

export const DEFAULT_VISUALIZATION_AGGREGATE = ALLOWED_EXPLORE_VISUALIZE_AGGREGATES[0]!;
export const DEFAULT_VISUALIZATION_FIELD = ALLOWED_EXPLORE_VISUALIZE_FIELDS[0]!;
export const DEFAULT_VISUALIZATION = `${DEFAULT_VISUALIZATION_AGGREGATE}(${DEFAULT_VISUALIZATION_FIELD})`;

export function defaultVisualizes(): Visualize[] {
  return [
    {
      chartType: ChartType.LINE,
      yAxes: [DEFAULT_VISUALIZATION],
      label: 'A',
    },
  ];
}

export interface BaseVisualize {
  chartType: ChartType;
  yAxes: string[];
}

export interface Visualize extends BaseVisualize {
  label: string;
}

export function getVisualizesFromLocation(
  location: Location,
  organization: Organization
): Visualize[] {
  const rawVisualizes = decodeList(location.query.visualize);

  const result: Visualize[] = rawVisualizes
    .map(raw => parseVisualizes(raw, organization))
    .filter(defined)
    .filter(parsed => parsed.yAxes.length > 0)
    .map((parsed, i) => {
      return {
        chartType: parsed.chartType,
        yAxes: parsed.yAxes,
        label: String.fromCharCode(65 + i), // starts from 'A'
      };
    });

  return result.length ? result : defaultVisualizes();
}

function parseVisualizes(raw: string, organization: Organization): BaseVisualize | null {
  try {
    const parsed = JSON.parse(raw);
    if (!defined(parsed) || !Array.isArray(parsed.yAxes)) {
      return null;
    }

    const yAxes = organization.features.includes('visibility-explore-equations')
      ? parsed.yAxes.filter((yAxis: string) => {
          const expression = new Expression(yAxis);
          return expression.isValid;
        })
      : parsed.yAxes.filter(parseFunction);
    if (yAxes.length <= 0) {
      return null;
    }

    let chartType = Number(parsed.chartType);
    if (isNaN(chartType) || !Object.values(ChartType).includes(chartType)) {
      chartType = ChartType.LINE;
    }

    return {yAxes, chartType};
  } catch (error) {
    return null;
  }
}

export function updateLocationWithVisualizes(
  location: Location,
  visualizes: BaseVisualize[] | null | undefined
) {
  if (defined(visualizes)) {
    location.query.visualize = visualizes.map(visualize =>
      JSON.stringify({
        chartType: visualize.chartType,
        yAxes: visualize.yAxes,
      })
    );
  } else if (visualizes === null) {
    delete location.query.visualize;
  }
}
