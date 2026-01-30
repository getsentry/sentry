import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import {openInsightChartModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {IconExpand} from 'sentry/icons';
import {t} from 'sentry/locale';
import {getIntervalForTimeSeriesQuery} from 'sentry/utils/timeSeries/getIntervalForTimeSeriesQuery';
import {useFetchSpanTimeSeries} from 'sentry/utils/timeSeries/useFetchEventsTimeSeries';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {Line} from 'sentry/views/dashboards/widgets/timeSeriesWidget/plottables/line';
import {TimeSeriesWidgetVisualization} from 'sentry/views/dashboards/widgets/timeSeriesWidget/timeSeriesWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {getExploreUrl} from 'sentry/views/explore/utils';
import {ChartType} from 'sentry/views/insights/common/components/chart';
import {BaseChartActionDropdown} from 'sentry/views/insights/common/components/chartActionDropdown';
import {ModalChartContainer} from 'sentry/views/insights/common/components/insightsChartContainer';
import {TimeSpentCell} from 'sentry/views/insights/common/components/tableCells/timeSpentCell';
import type {LoadableChartWidgetProps} from 'sentry/views/insights/common/components/widgets/types';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {getAlertsUrl} from 'sentry/views/insights/common/utils/getAlertsUrl';
import type {AddToSpanDashboardOptions} from 'sentry/views/insights/common/utils/useAddToSpanDashboard';
import {useAlertsProject} from 'sentry/views/insights/common/utils/useAlertsProject';
import {DomainCell} from 'sentry/views/insights/http/components/tables/domainCell';
import {Referrer} from 'sentry/views/insights/pages/frontend/referrers';
import {WidgetVisualizationStates} from 'sentry/views/insights/pages/platform/laravel/widgetVisualizationStates';
import {useReleaseBubbleProps} from 'sentry/views/insights/pages/platform/shared/getReleaseBubbleProps';
import {
  SeriesColorIndicator,
  WidgetFooterTable,
} from 'sentry/views/insights/pages/platform/shared/styles';
import {useTransactionNameQuery} from 'sentry/views/insights/pages/platform/shared/useTransactionNameQuery';
import {SpanFields} from 'sentry/views/insights/types';
import {WidgetEmptyStateWarning} from 'sentry/views/performance/landing/widgets/components/selectableList';

export default function OverviewTimeConsumingRequestsWidget(
  props: LoadableChartWidgetProps
) {
  const theme = useTheme();
  const {query} = useTransactionNameQuery();
  const releaseBubbleProps = useReleaseBubbleProps(props);
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const project = useAlertsProject();

  const search = new MutableSearch(`${SpanFields.SPAN_CATEGORY}:http ${query}`);
  const referrer = Referrer.TIME_CONSUMING_REQUESTS;
  const groupBy = SpanFields.SPAN_DOMAIN;
  const yAxes = `p75(${SpanFields.SPAN_DURATION})`;
  const totalTimeField = `sum(${SpanFields.SPAN_SELF_TIME})`;
  const title = t('Network Requests by Time Spent');
  const interval = getIntervalForTimeSeriesQuery(yAxes, selection.datetime);

  const {
    data: requestsListData,
    isLoading: isRequestsListLoading,
    error: requestsListError,
  } = useSpans(
    {
      fields: [
        SpanFields.PROJECT_ID,
        SpanFields.SPAN_DOMAIN,
        'time_spent_percentage()',
        totalTimeField,
      ],
      sorts: [{field: totalTimeField, kind: 'desc'}],
      search,
      limit: 3,
      noPagination: true,
    },
    referrer
  );

  const {
    data: requestSeriesData,
    isLoading: isRequestSeriesLoading,
    error: requestSeriesError,
  } = useFetchSpanTimeSeries(
    {
      query: `${SpanFields.SPAN_DOMAIN}:[${requestsListData?.map(item => `"${item[SpanFields.SPAN_DOMAIN]}"`).join(',')}]`,
      groupBy: [groupBy],
      yAxis: [yAxes],
      topEvents: 3,
      enabled: requestsListData?.length > 0,
      excludeOther: true,
      interval,
    },
    referrer
  );

  const isLoading = isRequestSeriesLoading || isRequestsListLoading;
  const error = requestSeriesError || requestsListError;
  const timeSeries = requestSeriesData?.timeSeries ?? [];

  const hasData =
    requestsListData && requestsListData.length > 0 && timeSeries.length > 0;

  const colorPalette = theme.chart.getColorPalette(timeSeries.length - 1);

  const plottables = timeSeries.map(
    (ts, index) => new Line(ts, {color: colorPalette[index]})
  );

  const visualization = (
    <WidgetVisualizationStates
      isEmpty={!hasData}
      isLoading={isLoading}
      error={error}
      emptyMessage={<WidgetEmptyStateWarning />}
      VisualizationType={TimeSeriesWidgetVisualization}
      visualizationProps={{
        id: 'overviewTimeConsumingRequestsWidget',
        showLegend: props.loaderSource === 'releases-drawer' ? 'auto' : 'never',
        plottables,
        ...props,
        ...releaseBubbleProps,
      }}
    />
  );

  const footer = hasData && (
    <WidgetFooterTable>
      {requestsListData?.map((item, index) => (
        <Fragment key={`${item[SpanFields.PROJECT_ID]}-${item[SpanFields.SPAN_DOMAIN]}`}>
          <div>
            <SeriesColorIndicator
              style={{
                backgroundColor: colorPalette[index],
              }}
            />
          </div>
          <DomainCell
            projectId={item[SpanFields.PROJECT_ID].toString()}
            domain={item[SpanFields.SPAN_DOMAIN]}
          />
          <TimeSpentCell
            percentage={item['time_spent_percentage()']}
            total={item[totalTimeField]}
            op="http.client"
          />
        </Fragment>
      ))}
    </WidgetFooterTable>
  );

  const exploreUrl = getExploreUrl({
    selection,
    organization,
    visualize: [
      {
        chartType: ChartType.LINE,
        yAxes: [yAxes],
      },
    ],
    mode: Mode.AGGREGATE,
    title,
    query: search?.formatString(),
    sort: undefined,
    groupBy: [groupBy],
    interval,
    referrer,
  });

  const addToDashboardOptions: AddToSpanDashboardOptions = {
    chartType: ChartType.LINE,
    yAxes: [yAxes],
    widgetName: title,
    groupBy: [groupBy],
    search,
    sort: {field: totalTimeField, kind: 'desc'},
    topEvents: 3,
  };

  return (
    <Widget
      Title={<Widget.WidgetTitle title={title} />}
      Visualization={visualization}
      Actions={
        hasData && (
          <Widget.WidgetToolbar>
            <Fragment>
              <BaseChartActionDropdown
                key="time consuming requests widget"
                exploreUrl={exploreUrl}
                referrer={referrer}
                addToDashboardOptions={addToDashboardOptions}
                alertMenuOptions={plottables.map(plottable => {
                  const domain = plottable.timeSeries.groupBy?.[0]?.value;
                  return {
                    key: plottable.name,
                    label: `${plottable.timeSeries.yAxis} : ${domain}`,
                    to: getAlertsUrl({
                      project,
                      aggregate: yAxes,
                      organization,
                      pageFilters: selection,
                      dataset: Dataset.EVENTS_ANALYTICS_PLATFORM,
                      query: `${SpanFields.SPAN_DOMAIN}:${domain}`,
                      referrer,
                    }),
                  };
                })}
              />
              <Button
                size="xs"
                aria-label={t('Open Full-Screen View')}
                priority="transparent"
                icon={<IconExpand />}
                onClick={() => {
                  openInsightChartModal({
                    title,
                    footer,
                    children: <ModalChartContainer>{visualization}</ModalChartContainer>,
                  });
                }}
              />
            </Fragment>
          </Widget.WidgetToolbar>
        )
      }
      noFooterPadding
      Footer={props.loaderSource === 'releases-drawer' ? undefined : footer}
    />
  );
}
