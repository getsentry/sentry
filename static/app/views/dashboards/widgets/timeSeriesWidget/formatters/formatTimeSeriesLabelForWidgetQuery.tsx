import {SERIES_NAME_PART_DELIMITER} from 'sentry/utils/timeSeries/transformLegacySeriesToTimeSeries';
import {formatTraceMetricsFunction} from 'sentry/views/dashboards/datasetConfig/formatTraceMetricsFunction';
import type {Widget, WidgetQuery} from 'sentry/views/dashboards/types';
import {WidgetType} from 'sentry/views/dashboards/types';
import {prettifyQueryConditions} from 'sentry/views/dashboards/utils/prettifyQueryConditions';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {formatTimeSeriesLabel} from 'sentry/views/dashboards/widgets/timeSeriesWidget/formatters/formatTimeSeriesLabel';

/**
 * Build the legend label that ``visualizationWidget`` would show for a
 * ``TimeSeries`` produced by ``widgetQuery`` within ``widget``.
 *
 * This is the label-parts assembly that previously lived inline in
 * ``transformWidgetSeriesToTimeSeries``; it is shared with the chartcuterie
 * dashboards-widget renderer so the server-rendered legend stays in lockstep
 * with the FE.
 */
export function formatTimeSeriesLabelForWidgetQuery(
  timeSeries: TimeSeries,
  widget: Widget,
  widgetQuery: WidgetQuery
): string {
  // The conditions prefix that ``getSeriesQueryPrefix`` adds in the
  // widget-query hooks for the FE — rebuilt here so callers that already
  // have a ``TimeSeries`` (chartcuterie) don't need their own copy.
  const queryName =
    widgetQuery.name ||
    (widget.queries.length > 1
      ? prettifyQueryConditions(widgetQuery.conditions)
      : undefined);

  const {aggregates, columns, fieldAliases = []} = widgetQuery;
  const fields = widgetQuery.fields ?? [...columns, ...aggregates];
  const {yAxis} = timeSeries;
  const fieldIndex = fields.indexOf(yAxis);
  // Only use field aliases for the yAxis if there are multiple yAxis and no group bys.
  const fieldAlias =
    aggregates.length > 1 && columns.length === 0 && fieldIndex >= 0
      ? fieldAliases[fieldIndex]
      : undefined;

  const labelParts: Array<string | undefined> = [
    queryName,
    fieldAlias ?? formatTimeSeriesLabel(timeSeries),
  ];
  // If there are multiple aggregates and columns, append the yAxis for uniqueness.
  if (aggregates.length > 1 && columns.length > 0) {
    labelParts.push(
      widget.widgetType === WidgetType.TRACEMETRICS
        ? (formatTraceMetricsFunction(yAxis) as string)
        : yAxis
    );
  }

  return labelParts.filter(Boolean).join(SERIES_NAME_PART_DELIMITER);
}
