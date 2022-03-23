import * as React from 'react';
import {withRouter, WithRouterProps} from 'react-router';
import styled from '@emotion/styled';
import {LegendComponentOption} from 'echarts';

import {Client} from 'sentry/api';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import SimpleTableChart from 'sentry/components/charts/simpleTableChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import space from 'sentry/styles/space';
import {Organization, PageFilters} from 'sentry/types';
import {EChartDataZoomHandler, EChartEventHandler} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {getIssueFieldRenderer} from 'sentry/utils/dashboards/issueFieldRenderers';
import {TableDataRow} from 'sentry/utils/discover/discoverQuery';

import {Widget, WidgetType} from '../types';
import {
  ISSUE_FIELD_TO_HEADER_MAP,
  ISSUE_FIELDS,
} from '../widgetBuilder/issueWidget/fields';

import WidgetCardChart from './chart';
import IssueWidgetQueries from './issueWidgetQueries';
import MetricsWidgetQueries from './metricsWidgetQueries';
import WidgetQueries from './widgetQueries';

type TableResultProps = Pick<WidgetQueries['state'], 'errorMessage' | 'loading'> & {
  transformedResults: TableDataRow[];
};

type Props = WithRouterProps & {
  api: Client;
  organization: Organization;
  selection: PageFilters;
  widget: Widget;
  expandNumbers?: boolean;
  isMobile?: boolean;
  legendOptions?: LegendComponentOption;
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
}: Props) {
  function issueTableResultComponent({
    loading,
    errorMessage,
    transformedResults,
  }: TableResultProps): React.ReactNode {
    if (errorMessage) {
      return (
        <ErrorPanel>
          <IconWarning color="gray500" size="lg" />
        </ErrorPanel>
      );
    }

    if (loading) {
      // Align height to other charts.
      return <LoadingPlaceholder height="200px" />;
    }

    const query = widget.queries[0];
    const queryFields = defined(query.fields)
      ? query.fields
      : [...query.columns, ...query.aggregates];

    return (
      <StyledSimpleTableChart
        location={location}
        title=""
        fields={queryFields}
        loading={loading}
        metadata={ISSUE_FIELDS}
        data={transformedResults}
        organization={organization}
        getCustomFieldRenderer={getIssueFieldRenderer}
        fieldHeaderMap={ISSUE_FIELD_TO_HEADER_MAP}
        stickyHeaders
      />
    );
  }

  function renderIssueChart() {
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
            <React.Fragment>
              {typeof renderErrorMessage === 'function'
                ? renderErrorMessage(errorMessage)
                : null}
              <LoadingScreen loading={loading} />
              {issueTableResultComponent({
                transformedResults,
                loading,
                errorMessage,
              })}
            </React.Fragment>
          );
        }}
      </IssueWidgetQueries>
    );
  }

  function renderMetricsChart() {
    return (
      <MetricsWidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
      >
        {({tableResults, timeseriesResults, errorMessage, loading}) => {
          return (
            <React.Fragment>
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
            </React.Fragment>
          );
        }}
      </MetricsWidgetQueries>
    );
  }

  function renderDiscoverChart() {
    return (
      <WidgetQueries
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        limit={tableItemLimit}
      >
        {({tableResults, timeseriesResults, errorMessage, loading}) => {
          return (
            <React.Fragment>
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
            </React.Fragment>
          );
        }}
      </WidgetQueries>
    );
  }

  if (widget.widgetType === WidgetType.ISSUE) {
    return renderIssueChart();
  }

  if (widget.widgetType === WidgetType.METRICS) {
    return renderMetricsChart();
  }

  return renderDiscoverChart();
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

const LoadingPlaceholder = styled(Placeholder)`
  background-color: ${p => p.theme.surface200};
`;

const StyledSimpleTableChart = styled(SimpleTableChart)`
  margin-top: ${space(1.5)};
  border-bottom-left-radius: ${p => p.theme.borderRadius};
  border-bottom-right-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeMedium};
  box-shadow: none;
`;
