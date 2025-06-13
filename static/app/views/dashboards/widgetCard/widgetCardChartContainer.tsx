import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {LegendComponentOption} from 'echarts';
import type {Location} from 'history';

import type {Client} from 'sentry/api';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {
  EChartDataZoomHandler,
  EChartEventHandler,
  Series,
} from 'sentry/types/echarts';
import type {Organization} from 'sentry/types/organization';
import type {TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';
import type {AggregationOutputType} from 'sentry/utils/discover/fields';
import {useLocation} from 'sentry/utils/useLocation';
import type {DashboardFilters, Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import WidgetLegendNameEncoderDecoder from 'sentry/views/dashboards/widgetLegendNameEncoderDecoder';
import type WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';

import WidgetCardChart from './chart';
import {IssueWidgetCard} from './issueWidgetCard';
import {WidgetCardDataLoader} from './widgetCardDataLoader';

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  widgetLegendState: WidgetLegendSelectionState;
  chartGroup?: string;
  dashboardFilters?: DashboardFilters;
  disableZoom?: boolean;
  expandNumbers?: boolean;
  isMobile?: boolean;
  legendOptions?: LegendComponentOption;
  minTableColumnWidth?: string;
  noPadding?: boolean;
  onDataFetchStart?: () => void;
  onDataFetched?: (results: {
    pageLinks?: string;
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
    timeseriesResultsTypes?: Record<string, AggregationOutputType>;
    totalIssuesCount?: string;
  }) => void;
  onLegendSelectChanged?: EChartEventHandler<{
    name: string;
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }>;
  onWidgetSplitDecision?: (splitDecision: WidgetType) => void;
  onZoom?: EChartDataZoomHandler;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  shouldResize?: boolean;
  showConfidenceWarning?: boolean;
  showLoadingText?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

export function WidgetCardChartContainer({
  organization,
  selection,
  widget,
  dashboardFilters,
  isMobile,
  renderErrorMessage,
  tableItemLimit,
  windowWidth,
  onZoom,
  onLegendSelectChanged,
  legendOptions,
  expandNumbers,
  onDataFetched,
  noPadding,
  onWidgetSplitDecision,
  chartGroup,
  shouldResize,
  widgetLegendState,
  showConfidenceWarning,
  minTableColumnWidth,
  onDataFetchStart,
  disableZoom,
  showLoadingText,
}: Props) {
  const location = useLocation();

  function keepLegendState({
    selected,
  }: {
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }) {
    widgetLegendState.setWidgetSelectionState(selected, widget);
  }

  function getErrorOrEmptyMessage(
    errorMessage: string | undefined,
    timeseriesResults: Series[] | undefined,
    tableResults: TableDataWithTitle[] | undefined,
    widgetType: DisplayType
  ) {
    // non-chart widgets need to look at tableResults
    const results =
      widgetType === DisplayType.BIG_NUMBER || widgetType === DisplayType.TABLE
        ? tableResults
        : timeseriesResults;

    return errorMessage
      ? errorMessage
      : results === undefined || results?.length === 0
        ? t('No data found')
        : undefined;
  }

  return (
    <WidgetCardDataLoader
      widget={widget}
      dashboardFilters={dashboardFilters}
      selection={selection}
      onDataFetched={onDataFetched}
      onWidgetSplitDecision={onWidgetSplitDecision}
      onDataFetchStart={onDataFetchStart}
      tableItemLimit={tableItemLimit}
    >
      {({
        tableResults,
        timeseriesResults,
        errorMessage,
        loading,
        timeseriesResultsTypes,
        confidence,
        sampleCount,
        isSampled,
      }) => {
        // Bind timeseries to widget for ability to control each widget's legend individually
        const modifiedTimeseriesResults =
          WidgetLegendNameEncoderDecoder.modifyTimeseriesNames(widget, timeseriesResults);

        const errorOrEmptyMessage = loading
          ? errorMessage
          : getErrorOrEmptyMessage(
              errorMessage,
              modifiedTimeseriesResults,
              tableResults,
              widget.displayType
            );

        if (widget.widgetType === WidgetType.ISSUE) {
          return (
            <Fragment>
              {typeof renderErrorMessage === 'function'
                ? renderErrorMessage(errorOrEmptyMessage)
                : null}
              <LoadingScreen loading={loading} showLoadingText={showLoadingText} />
              <IssueWidgetCard
                transformedResults={tableResults?.[0]!.data ?? []}
                loading={loading}
                errorMessage={errorOrEmptyMessage}
                widget={widget}
                location={location}
                selection={selection}
              />
            </Fragment>
          );
        }

        return (
          <Fragment>
            {typeof renderErrorMessage === 'function'
              ? renderErrorMessage(errorOrEmptyMessage)
              : null}
            <WidgetCardChart
              disableZoom={disableZoom}
              timeseriesResults={modifiedTimeseriesResults}
              tableResults={tableResults}
              errorMessage={errorOrEmptyMessage}
              loading={loading}
              location={location}
              widget={widget}
              selection={selection}
              organization={organization}
              isMobile={isMobile}
              windowWidth={windowWidth}
              expandNumbers={expandNumbers}
              onZoom={onZoom}
              timeseriesResultsTypes={timeseriesResultsTypes}
              noPadding={noPadding}
              chartGroup={chartGroup}
              shouldResize={shouldResize}
              onLegendSelectChanged={
                onLegendSelectChanged ? onLegendSelectChanged : keepLegendState
              }
              legendOptions={
                legendOptions
                  ? legendOptions
                  : {selected: widgetLegendState.getWidgetSelectionState(widget)}
              }
              widgetLegendState={widgetLegendState}
              showConfidenceWarning={showConfidenceWarning}
              confidence={confidence}
              sampleCount={sampleCount}
              minTableColumnWidth={minTableColumnWidth}
              isSampled={isSampled}
              showLoadingText={showLoadingText}
            />
          </Fragment>
        );
      }}
    </WidgetCardDataLoader>
  );
}

const StyledTransparentLoadingMask = styled((props: any) => (
  <TransparentLoadingMask {...props} maskBackgroundColor="transparent" />
))`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
  justify-content: center;
  align-items: center;
  pointer-events: none;
`;

function LoadingScreen({
  loading,
  showLoadingText,
}: {
  loading: boolean;
  showLoadingText?: boolean;
}) {
  if (!loading) {
    return null;
  }
  return (
    <StyledTransparentLoadingMask visible={loading}>
      <LoadingIndicator mini />
      {showLoadingText && <p>{t('Turning data into pixels - almost ready')}</p>}
    </StyledTransparentLoadingMask>
  );
}
