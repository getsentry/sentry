import {Fragment} from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import {LegendComponentOption} from 'echarts';

import {Client} from 'sentry/api';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Organization, PageFilters} from 'sentry/types';
import {EChartDataZoomHandler, EChartEventHandler, Series} from 'sentry/types/echarts';

import {Widget, WidgetType} from '../types';

import WidgetCardChart from './chart';
import {IssueWidgetCard} from './issueWidgetCard';
import IssueWidgetQueries from './issueWidgetQueries';
import MetricsWidgetQueries from './metricsWidgetQueries';
import WidgetQueries from './widgetQueries';

type Props = WithRouterProps & {
  api: Client;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  expandNumbers?: boolean;
  isMobile?: boolean;
  legendOptions?: LegendComponentOption;
  onDataFetched?: (results: {timeseriesResults?: Series[]}) => void;
  onLegendSelectChanged?: EChartEventHandler<{
    name: string;
    selected: Record<string, boolean>;
    type: 'legendselectchanged';
  }>;
  onZoom?: EChartDataZoomHandler;
  renderErrorMessage?: (errorMessage?: string) => React.ReactNode;
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
}: Props) {
  if (widget.widgetType === WidgetType.ISSUE) {
    return (
      <IssueWidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
      >
        {({transformedResults, errorMessage, loading}) => {
          return (
            <Fragment>
              {typeof renderErrorMessage === 'function'
                ? renderErrorMessage(errorMessage)
                : null}
              <LoadingScreen loading={loading} />
              <IssueWidgetCard
                transformedResults={transformedResults}
                loading={loading}
                errorMessage={errorMessage}
                widget={widget}
                organization={organization}
                location={location}
                selection={selection}
              />
            </Fragment>
          );
        }}
      </IssueWidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.METRICS) {
    return (
      <MetricsWidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        limit={widget.limit ?? tableItemLimit}
      >
        {({tableResults, timeseriesResults, errorMessage, loading}) => {
          return (
            <Fragment>
              {typeof renderErrorMessage === 'function'
                ? renderErrorMessage(errorMessage)
                : null}
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
              />
            </Fragment>
          );
        }}
      </MetricsWidgetQueries>
    );
  }

  return (
    <WidgetQueries
      api={api}
      organization={organization}
      widget={widget}
      selection={selection}
      limit={tableItemLimit}
      onDataFetched={onDataFetched}
    >
      {({tableResults, timeseriesResults, errorMessage, loading}) => {
        return (
          <Fragment>
            {typeof renderErrorMessage === 'function'
              ? renderErrorMessage(errorMessage)
              : null}
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
            />
          </Fragment>
        );
      }}
    </WidgetQueries>
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
