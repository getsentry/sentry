import type {
  InvestigationDisplay,
  InvestigationQueryResult,
  InvestigationVisualization,
} from 'sentry/views/seerNotebook/types';

export type VisualizationResolution = {
  isFallback: boolean;
  visualization: InvestigationVisualization | null;
};

export function isQueryResult(value: unknown): value is InvestigationQueryResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'schemaVersion' in value &&
    value.schemaVersion === 1 &&
    'query' in value &&
    'table' in value &&
    typeof value.table === 'object' &&
    value.table !== null &&
    'columns' in value.table &&
    'rows' in value.table &&
    Array.isArray(value.table.columns) &&
    Array.isArray(value.table.rows)
  );
}

export function resolveVisualization(
  display: InvestigationDisplay,
  output: InvestigationQueryResult
): VisualizationResolution {
  const suggestion = output.suggestedVisualization;
  if (!suggestion) {
    return {visualization: null, isFallback: false};
  }
  if (!display.version || display.type === 'table' || display.type === 'markdown') {
    return {visualization: suggestion, isFallback: false};
  }
  const availableSeries = new Set(output.chart?.series.map(series => series.name));
  const requestedSeries = display.yAxes?.length ? display.yAxes : suggestion.yFields;
  if (requestedSeries.some(series => !availableSeries.has(series))) {
    return {visualization: suggestion, isFallback: true};
  }
  return {
    isFallback: false,
    visualization: {
      ...suggestion,
      type: display.type,
      title: display.title ?? suggestion.title,
      subtitle: display.subtitle ?? suggestion.subtitle,
      xField: display.xAxis ?? suggestion.xField,
      yFields: requestedSeries,
      seriesField: display.seriesField ?? suggestion.seriesField,
      unit: display.unit ?? suggestion.unit,
      axisLabel: display.axisLabel ?? suggestion.axisLabel,
      stacked: display.stacked ?? suggestion.stacked,
      showLegend: display.showLegend ?? suggestion.showLegend,
      sort: display.sort ?? suggestion.sort,
      topN: display.topN ?? suggestion.topN,
    },
  };
}

export function displayFromVisualization(
  current: InvestigationDisplay,
  visualization: InvestigationVisualization,
  change: Partial<InvestigationDisplay> = {}
): InvestigationDisplay {
  return {
    ...current,
    version: 1,
    type: visualization.type,
    xAxis: visualization.xField,
    yAxes: visualization.yFields,
    unit: visualization.unit,
    stacked: visualization.stacked,
    showLegend: visualization.showLegend,
    title: visualization.title,
    subtitle: visualization.subtitle ?? undefined,
    axisLabel: visualization.axisLabel ?? undefined,
    seriesField: visualization.seriesField ?? undefined,
    sort: visualization.sort,
    topN: visualization.topN ?? undefined,
    ...change,
  };
}

export function validateVisualizationDisplay(
  display: InvestigationDisplay,
  output: InvestigationQueryResult
): string | null {
  if (!output.chart || !output.suggestedVisualization) {
    return 'chart_unavailable';
  }
  if (display.type === 'table' || display.type === 'markdown') {
    return 'invalid_visualization_type';
  }
  const series = new Set(output.chart.series.map(item => item.name));
  if (!display.yAxes?.length || display.yAxes.some(field => !series.has(field))) {
    return 'unavailable_y_axis';
  }
  const columns = new Set(output.table.columns.map(column => column.key));
  if (
    display.seriesField &&
    !columns.has(display.seriesField) &&
    !output.query.groupBy.includes(display.seriesField)
  ) {
    return 'unavailable_series_field';
  }
  return null;
}

export function makeChartData(
  output: InvestigationQueryResult,
  visualization: InvestigationVisualization
) {
  const requested = new Set(visualization.yFields);
  return (output.chart?.series ?? [])
    .filter(series => requested.has(series.name))
    .map(series => {
      const data = [...series.data];
      if (visualization.sort !== 'none') {
        data.sort((left, right) =>
          visualization.sort === 'ascending' ? left.y - right.y : right.y - left.y
        );
      }
      return {
        name: series.name,
        data: data.slice(0, visualization.topN ?? data.length),
      };
    });
}
