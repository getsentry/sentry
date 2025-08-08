import type {Location} from 'history';

import {defined} from 'sentry/utils';
import {decodeList} from 'sentry/utils/queryString';
import {determineDefaultChartType} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {ChartType} from 'sentry/views/insights/common/components/chart';

interface VisualizeOptions {
  chartType?: ChartType;
}

export class Visualize {
  readonly yAxis: string;
  readonly chartType: ChartType;
  private readonly selectedChartType?: ChartType;

  constructor(yAxis: string, options?: VisualizeOptions) {
    this.yAxis = yAxis;
    this.selectedChartType = options?.chartType;
    this.chartType = this.selectedChartType ?? determineDefaultChartType([yAxis]);
  }

  clone(): Visualize {
    return new Visualize(this.yAxis, {
      chartType: this.selectedChartType,
    });
  }

  replace({chartType, yAxis}: {chartType?: ChartType; yAxis?: string}): Visualize {
    return new Visualize(yAxis ?? this.yAxis, {
      chartType: chartType ?? this.selectedChartType,
    });
  }

  toJSON(): BaseVisualize {
    const json: BaseVisualize = {
      yAxes: [this.yAxis],
    };

    if (defined(this.selectedChartType)) {
      json.chartType = this.selectedChartType;
    }

    return json;
  }

  static fromJSON(json: BaseVisualize): Visualize[] {
    return json.yAxes.map(yAxis => new Visualize(yAxis, {chartType: json.chartType}));
  }
}

export function getVisualizesFromLocation(
  location: Location,
  key: string
): Visualize[] | null {
  const rawVisualizes = decodeList(location.query?.[key]);

  const visualizes: Visualize[] = [];

  for (const rawVisualize of rawVisualizes) {
    let value: any;
    try {
      value = JSON.parse(rawVisualize);
    } catch (error) {
      continue;
    }
    for (const visualize of parseVisualize(value)) {
      visualizes.push(visualize);
    }
  }

  return visualizes.length ? visualizes : null;
}

export function parseVisualize(value: any): Visualize[] {
  if (isBaseVisualize(value)) {
    return value.yAxes.map(yAxis => new Visualize(yAxis, {chartType: value.chartType}));
  }
  return [];
}

export function isVisualize(value: any): value is Visualize {
  return defined(value) && typeof value === 'object' && typeof value.yAxis === 'string';
}

interface BaseVisualize {
  yAxes: readonly string[];
  chartType?: ChartType;
}

function isBaseVisualize(value: any): value is BaseVisualize {
  const hasYAxes =
    defined(value) &&
    typeof value === 'object' &&
    Array.isArray(value.yAxes) &&
    value.yAxes.every((yAxis: any) => typeof yAxis === 'string');

  if (hasYAxes) {
    // check for valid chart type
    if (defined(value.chartType)) {
      return Object.values(ChartType).includes(value.chartType);
    }

    // unselected chart type
    return true;
  }

  return false;
}
