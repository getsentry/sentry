import {useState} from 'react';

import PanelAlert from 'sentry/components/panels/panelAlert';
import {dedupeArray} from 'sentry/utils/dedupeArray';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {Sort} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  DisplayType,
  WidgetType,
  type DashboardDetails,
  type DashboardFilters,
} from 'sentry/views/dashboards/types';
import {isChartDisplayType} from 'sentry/views/dashboards/utils';
import {widgetCanUseTimeSeriesVisualization} from 'sentry/views/dashboards/utils/widgetCanUseTimeSeriesVisualization';
import {useWidgetBuilderContext} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';
import {BuilderStateAction} from 'sentry/views/dashboards/widgetBuilder/hooks/useWidgetBuilderState';
import {convertBuilderStateToWidget} from 'sentry/views/dashboards/widgetBuilder/utils/convertBuilderStateToWidget';
import WidgetCard from 'sentry/views/dashboards/widgetCard';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';
import WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';
import type {TabularColumn} from 'sentry/views/dashboards/widgets/common/types';

interface WidgetPreviewProps {
  dashboard: DashboardDetails;
  dashboardFilters: DashboardFilters;
  isWidgetInvalid?: boolean;
  onDataFetched?: (tableData: TableDataWithTitle[]) => void;
  shouldForceDescriptionTooltip?: boolean;
}

const MIN_TABLE_COLUMN_WIDTH_PX = 125;

function WidgetPreview({
  dashboard,
  dashboardFilters,
  isWidgetInvalid,
  onDataFetched,
  shouldForceDescriptionTooltip,
}: WidgetPreviewProps) {
  const organization = useOrganization();
  const location = useLocation();
  const navigate = useNavigate();
  const pageFilters = usePageFilters();

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

  const isChart = isChartDisplayType(widget.displayType);

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
    const widths = columns.map(column => column.width as number);
    setTableWidths(widths);
  }

  const useTimeseriesVisualization = widgetCanUseTimeSeriesVisualization(widget);

  return (
    <WidgetCard
      disableFullscreen
      borderless
      // need to pass in undefined to avoid tooltip not showing up on hover
      forceDescriptionTooltip={shouldForceDescriptionTooltip ? true : undefined}
      isWidgetInvalid={isWidgetInvalid}
      shouldResize={state.displayType !== DisplayType.TABLE}
      organization={organization}
      selection={pageFilters.selection}
      widget={
        widget.widgetType === WidgetType.SPANS && isChart
          ? widgetWithDedupedYAxes
          : widget
      }
      dashboardFilters={dashboardFilters}
      isEditingDashboard={false}
      widgetLimitReached={false}
      showContextMenu={false}
      renderErrorMessage={errorMessage =>
        typeof errorMessage === 'string' && (
          <PanelAlert type="danger">{errorMessage}</PanelAlert>
        )
      }
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

      showConfidenceWarning={widget.widgetType === WidgetType.SPANS}
      // ensure table columns are at least a certain width (helps with lack of truncation on large fields)
      minTableColumnWidth={MIN_TABLE_COLUMN_WIDTH_PX}
      disableZoom
      showLoadingText
      onWidgetTableSort={handleWidgetTableSort}
      onWidgetTableResizeColumn={handleWidgetTableResizeColumn}
      disableTableActions
      useTimeseriesVisualization={useTimeseriesVisualization}
    />
  );
}

export default WidgetPreview;
