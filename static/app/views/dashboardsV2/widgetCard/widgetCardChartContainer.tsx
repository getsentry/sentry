import {Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import type {DataZoomComponentOption} from 'echarts';
import {LegendComponentOption} from 'echarts';

import {Client} from 'sentry/api';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Organization, PageFilters} from 'sentry/types';
import {EChartEventHandler, Series} from 'sentry/types/echarts';
import {TableDataRow, TableDataWithTitle} from 'sentry/utils/discover/discoverQuery';

import {getDatasetConfig} from '../datasetConfig/base';
import {Widget, WidgetType} from '../types';

import WidgetCardChart, {AugmentedEChartDataZoomHandler} from './chart';
import {IssueWidgetCard} from './issueWidgetCard';

type Props = WithRouterProps & {
  api: Client;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  chartZoomOptions?: DataZoomComponentOption;
  expandNumbers?: boolean;
  isMobile?: boolean;
  legendOptions?: LegendComponentOption;
  noPadding?: boolean;
  onDataFetched?: (results: {
    issuesResults?: TableDataRow[];
    pageLinks?: string;
    tableResults?: TableDataWithTitle[];
    timeseriesResults?: Series[];
    totalIssuesCount?: string;
  }) => void;
  onLegendSelectChanged?: EChartEventHandler<{
    name: string;
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }>;
  onZoom?: AugmentedEChartDataZoomHandler;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
  showSlider?: boolean;
  tableItemLimit?: number;
  windowWidth?: number;
};

export function WidgetCardChartContainer({
  location,
  router,
  api,
  organization,
  selection,
  widget,
  isMobile,
  renderErrorMessage,
  tableItemLimit,
  windowWidth,
  onZoom,
  onLegendSelectChanged,
  legendOptions,
  expandNumbers,
  onDataFetched,
  showSlider,
  noPadding,
  chartZoomOptions,
}: Props) {
  const datasetConfig = getDatasetConfig(widget.widgetType);

  return (
    <datasetConfig.WidgetQueries
      api={api}
      organization={organization}
      widget={widget}
      selection={selection}
      limit={tableItemLimit}
      onDataFetched={onDataFetched}
    >
      {({timeseriesResults, tableResults, errorMessage, loading}) => {
        return (
          <Fragment>
            {typeof renderErrorMessage === 'function'
              ? renderErrorMessage(errorMessage)
              : null}
            <LoadingScreen loading={loading} />
            {widget.widgetType === WidgetType.ISSUE ? (
              <IssueWidgetCard
                transformedResults={tableResults}
                loading={loading}
                errorMessage={errorMessage}
                widget={widget}
                organization={organization}
                location={location}
                selection={selection}
              />
            ) : (
              <WidgetCardChart
                timeseriesResults={timeseriesResults}
                tableResults={tableResults}
                errorMessage={errorMessage}
                loading={loading}
                location={location}
                widget={widget}
                selection={selection}
                router={router}
                organization={organization}
                isMobile={isMobile}
                windowWidth={windowWidth}
                onZoom={onZoom}
                onLegendSelectChanged={onLegendSelectChanged}
                legendOptions={legendOptions}
                expandNumbers={expandNumbers}
                showSlider={showSlider}
                noPadding={noPadding}
                chartZoomOptions={chartZoomOptions}
              />
            )}
          </Fragment>
        );
      }}
    </datasetConfig.WidgetQueries>
  );
}

export default withRouter(WidgetCardChartContainer);

const StyledTransparentLoadingMask = styled(props => (
  <TransparentLoadingMask {...props} maskBackgroundColor="transparent" />
))`
  display: flex;
  justify-content: center;
  align-items: center;
`;

const LoadingScreen = ({loading}: {loading: boolean}) => {
  if (!loading) {
    return null;
  }
  return (
    <StyledTransparentLoadingMask visible={loading}>
      <LoadingIndicator mini />
    </StyledTransparentLoadingMask>
  );
};
