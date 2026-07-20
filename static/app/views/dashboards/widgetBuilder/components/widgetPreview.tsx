import {useState} from 'react';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import {type Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useDashboardChartInterval} from 'sentry/views/dashboards/hooks/useDashboardChartInterval';
import {
  DisplayType,
  WidgetType,
  type DashboardDetails,
  type DashboardFilters,
} from 'sentry/views/dashboards/types';
import {usesTimeSeriesData} from 'sentry/views/dashboards/utils';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {getTraceMetricAggregateSource} from 'sentry/views/dashboards/widgetBuilder/utils/buildTraceMetricAggregate';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import type {OnDataFetchedParams} from 'sentry/views/dashboards/widgetCard';
import WidgetCard from 'sentry/views/dashboards/widgetCard';
import {WidgetLegendNameEncoderDecoder} from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';
import {WidgetLegendSelectionState} from 'sentry/views/dashboards/widgetLegendSelectionState';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {FieldValueKind} from 'sentry/views/discover/table/types';

interface WidgetPreviewProps {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
  isQueryConditionInvalid?: boolean;
  onDataFetched?: (results: OnDataFetchedParams) => void;
  shouldForceDescriptionTooltip?: boolean;
}

const MIN_TABLE_COLUMN_WIDTH_PX = 125;

export function WidgetPreview({
  dashboard,
  dashboardFilters,
  isQueryConditionInvalid,
  onDataFetched,
  shouldForceDescriptionTooltip,
}: WidgetPreviewProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const pageFilters = usePageFilters();
  const [chartInterval] = useDashboardChartInterval();

  const {state, dispatch} = useWidgetBuilderContext();
  const [tableWidths, setTableWidths] = useState<number[]>();

  const widget = {...convertBuilderStateToWidget(state), tableWidths};

  const widgetLegendState = new WidgetLegendSelectionState({
    location,
    organization,
    dashboard,
    navigate,
  });

  // TODO: The way we create the widget here does not propagate a widget ID
  // to pass to the legend encoder decoder.
  const unselectedReleasesForCharts = {
    [WidgetLegendNameEncoderDecoder.encodeSeriesNameForLegend('Releases', undefined)]:
      false,
  };

  const isTimeSeries = usesTimeSeriesData(widget.displayType);

  // the spans dataset doesn't handle timeseries for duplicate yAxes/aggregates
  // automatically, so we need to dedupe them
  const widgetWithDedupedYAxes = {
    ...widget,
    queries: widget.queries.map(query => {
      const dedupedAggregates = dedupeArray(query.aggregates);

      return {
        ...query,
        aggregates: dedupedAggregates,
      };
    }),
  };

  function handleWidgetTableSort(sort: Sort) {
    dispatch({
      payload: [sort],
      type: BuilderStateAction.SET_SORT,
    });
  }

  function handleWidgetTableResizeColumn(columns: TabularColumn[]) {
    const widths = columns.map(column => column.width!);
    setTableWidths(widths);
  }

  if (widget.widgetType === WidgetType.TRACEMETRICS) {
    const hasBlankEquation = getTraceMetricAggregateSource(
      state.displayType,
      state.yAxis,
      state.fields
    )?.some(
      aggregate =>
        aggregate.kind === FieldValueKind.EQUATION && aggregate.field.trim() === ''
    );
    if (hasBlankEquation) {
      return (
        <Widget
          Title={<Widget.WidgetTitle title={widget.title} />}
          Visualization={
            <Widget.WidgetError error={t('Enter an equation to preview results')} />
          }
          noVisualizationPadding
        />
      );
    }
  }

  if (isQueryConditionInvalid) {
    return (
      <Widget
        Title={<Widget.WidgetTitle title={widget.title} />}
        Visualization={
          <Widget.WidgetError error={t('Widget query condition is invalid.')} />
        }
        noVisualizationPadding
      />
    );
  }

  return (
    <WidgetCard
      disableFullscreen
      borderless
      // need to pass in undefined to avoid tooltip not showing up on hover
      forceDescriptionTooltip={shouldForceDescriptionTooltip ? true : undefined}
      shouldResize={state.displayType !== DisplayType.TABLE}
      selection={pageFilters.selection}
      widget={
        widget.widgetType === WidgetType.SPANS && isTimeSeries
          ? widgetWithDedupedYAxes
          : widget
      }
      dashboardFilters={dashboardFilters}
      widgetLimitReached={false}
      showContextMenu={false}
      widgetInterval={chartInterval}
      onLegendSelectChanged={() => {}}
      legendOptions={
        widgetLegendState.widgetRequiresLegendUnselection(widget)
          ? {selected: unselectedReleasesForCharts}
          : undefined
      }
      widgetLegendState={widgetLegendState}
      onDataFetched={onDataFetched}
      // TODO: This requires the current widget ID and a helper to update the
      // dashboard state to be added
      onWidgetSplitDecision={() => {}}
      // onWidgetSplitDecision={onWidgetSplitDecision}
      tableItemLimit={widget.limit ?? undefined}
      showConfidenceWarning={
        widget.widgetType === WidgetType.SPANS ||
        widget.widgetType === WidgetType.TRACEMETRICS ||
        widget.widgetType === WidgetType.LOGS
      }
      // ensure table columns are at least a certain width (helps with lack of truncation on large fields)
      minTableColumnWidth={MIN_TABLE_COLUMN_WIDTH_PX}
      disableZoom
      showLoadingText
      onWidgetTableSort={handleWidgetTableSort}
      onWidgetTableResizeColumn={handleWidgetTableResizeColumn}
      disableTableActions
    />
  );
}
