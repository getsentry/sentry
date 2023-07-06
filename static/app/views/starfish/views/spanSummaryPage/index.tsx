import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import * as qs from 'query-string';

import Breadcrumbs, {Crumb} from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import {Panel, PanelBody} from 'sentry/components/panels';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {fromSorts} from 'sentry/utils/discover/eventView';
import {Sort} from 'sentry/utils/discover/fields';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import {ERRORS_COLOR, P95_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import StarfishDatePicker from 'sentry/views/starfish/components/datePicker';
import StarfishPageFilterContainer from 'sentry/views/starfish/components/pageFilterContainer';
import {SpanDescription} from 'sentry/views/starfish/components/spanDescription';
import {CountCell} from 'sentry/views/starfish/components/tableCells/countCell';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {SpanMeta} from 'sentry/views/starfish/queries/useSpanMeta';
import {SpanMetrics, useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {SpanMetricsFields} from 'sentry/views/starfish/types';
import formatThroughput from 'sentry/views/starfish/utils/chartValueFormatters/formatThroughput';
import {extractRoute} from 'sentry/views/starfish/utils/extractRoute';
import {ROUTE_NAMES} from 'sentry/views/starfish/utils/routeNames';
import {QueryParameterNames} from 'sentry/views/starfish/views/queryParameters';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {SampleList} from 'sentry/views/starfish/views/spanSummaryPage/sampleList';
import {
  isAValidSort,
  SpanTransactionsTable,
} from 'sentry/views/starfish/views/spanSummaryPage/spanTransactionsTable';

const {SPAN_SELF_TIME} = SpanMetricsFields;

const DEFAULT_SORT: Sort = {
  kind: 'desc',
  field: 'time_spent_percentage(local)',
};

type Props = {
  location: Location;
} & RouteComponentProps<{groupId: string}, {transaction: string}>;

function SpanSummaryPage({params, location}: Props) {
  const organization = useOrganization();
  const {groupId} = params;
  const {transaction, transactionMethod, endpoint, endpointMethod} = location.query;

  const queryFilter = endpoint ? {transactionName: endpoint} : undefined;
  const sort =
    fromSorts(location.query[QueryParameterNames.SORT]).filter(isAValidSort)[0] ??
    DEFAULT_SORT; // We only allow one sort on this table in this view

  if (endpointMethod && queryFilter) {
    queryFilter['transaction.method'] = endpointMethod;
  }

  const {data: spanMetrics, isLoading: isSpanMetricsLoading} = useSpanMetrics(
    {group: groupId},
    queryFilter,
    [
      'span.op',
      'span.description',
      'span.action',
      'span.domain',
      'count()',
      'sps()',
      `sum(${SPAN_SELF_TIME})`,
      `p95(${SPAN_SELF_TIME})`,
      'time_spent_percentage()',
      'http_error_count()',
    ],
    'span-summary-page-metrics'
  );

  const span = Object.assign({group: groupId}, spanMetrics as SpanMetrics & SpanMeta);

  const {isLoading: areSpanMetricsSeriesLoading, data: spanMetricsSeriesData} =
    useSpanMetricsSeries(
      {group: groupId},
      queryFilter,
      [`p95(${SPAN_SELF_TIME})`, 'sps()', 'http_error_count()'],
      'span-summary-page-metrics'
    );

  useSynchronizeCharts([!areSpanMetricsSeriesLoading]);

  const spanMetricsThroughputSeries = {
    seriesName: span?.['span.op']?.startsWith('db') ? 'Queries' : 'Requests',
    data: spanMetricsSeriesData?.['sps()'].data,
  };

  const title = getDescriptionLabel(location, span, true);
  const spanDescriptionCardTitle = getDescriptionLabel(location, span);

  const crumbs: Crumb[] = [];
  crumbs.push({
    label: t('Web Service'),
    to: normalizeUrl(`/organizations/${organization.slug}/starfish/`),
  });
  const extractedRoute = extractRoute(location);
  if (extractedRoute && ROUTE_NAMES[extractedRoute]) {
    crumbs.push({
      label: ROUTE_NAMES[extractedRoute],
      to: normalizeUrl(
        `/organizations/${organization.slug}/starfish/${
          extractedRoute ?? 'spans'
        }/?${qs.stringify({
          endpoint,
          'http.method': endpointMethod,
        })}`
      ),
    });
  }
  crumbs.push({
    label: title,
  });

  return (
    <Layout.Page>
      <StarfishPageFilterContainer>
        <PageErrorProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              {!isSpanMetricsLoading && <Breadcrumbs crumbs={crumbs} />}
              <Layout.Title>
                {endpointMethod && endpoint
                  ? `${endpointMethod} ${endpoint}`
                  : !isSpanMetricsLoading && title}
              </Layout.Title>
            </Layout.HeaderContent>
          </Layout.Header>
          <Layout.Body>
            <Layout.Main fullWidth>
              <PageErrorAlert />
              <BlockContainer>
                <FilterOptionsContainer>
                  <StarfishDatePicker />
                </FilterOptionsContainer>
                <BlockContainer>
                  <Block title={t('Operation')}>{span?.['span.op']}</Block>
                  <Block
                    title={t('Throughput')}
                    description={t('Throughput of this span per second')}
                  >
                    <ThroughputCell throughputPerSecond={spanMetrics?.['sps()']} />
                  </Block>
                  <Block
                    title={t('Duration (P95)')}
                    description={t('Time spent in this span')}
                  >
                    <DurationCell
                      milliseconds={spanMetrics?.[`p95(${SPAN_SELF_TIME})`]}
                    />
                  </Block>
                  {span?.['span.op']?.startsWith('http') && (
                    <Block
                      title={t('5XX Responses')}
                      description={t('5XX responses in this span')}
                    >
                      <CountCell count={spanMetrics?.[`http_error_count()`]} />
                    </Block>
                  )}
                  <Block
                    title={t('Time Spent')}
                    description={t(
                      'Time spent in this span as a proportion of total application time'
                    )}
                  >
                    <TimeSpentCell
                      timeSpentPercentage={spanMetrics?.['time_spent_percentage()']}
                      totalSpanTime={spanMetrics?.[`p95(${SPAN_SELF_TIME})`]}
                    />
                  </Block>
                </BlockContainer>
              </BlockContainer>

              {span?.['span.description'] && (
                <BlockContainer>
                  <Block>
                    <Panel>
                      <DescriptionPanelBody>
                        <DescriptionContainer>
                          <DescriptionTitle>{spanDescriptionCardTitle}</DescriptionTitle>
                          <SpanDescription spanMeta={span} />
                        </DescriptionContainer>
                      </DescriptionPanelBody>
                    </Panel>
                  </Block>

                  <Block>
                    <ChartPanel title={DataTitles.throughput}>
                      <Chart
                        statsPeriod="24h"
                        height={140}
                        data={[spanMetricsThroughputSeries]}
                        start=""
                        end=""
                        loading={areSpanMetricsSeriesLoading}
                        utc={false}
                        chartColors={[THROUGHPUT_COLOR]}
                        isLineChart
                        definedAxisTicks={4}
                        aggregateOutputFormat="rate"
                        tooltipFormatterOptions={{
                          valueFormatter: value => formatThroughput(value),
                        }}
                      />
                    </ChartPanel>
                  </Block>

                  <Block>
                    <ChartPanel title={DataTitles.p95}>
                      <Chart
                        statsPeriod="24h"
                        height={140}
                        data={[spanMetricsSeriesData?.[`p95(${SPAN_SELF_TIME})`]]}
                        start=""
                        end=""
                        loading={areSpanMetricsSeriesLoading}
                        utc={false}
                        chartColors={[P95_COLOR]}
                        isLineChart
                        definedAxisTicks={4}
                      />
                    </ChartPanel>
                  </Block>

                  {span?.['span.op']?.startsWith('http') && (
                    <Block>
                      <ChartPanel title={DataTitles.errorCount}>
                        <Chart
                          statsPeriod="24h"
                          height={140}
                          data={[spanMetricsSeriesData?.[`http_error_count()`]]}
                          start=""
                          end=""
                          loading={areSpanMetricsSeriesLoading}
                          utc={false}
                          chartColors={[ERRORS_COLOR]}
                          isLineChart
                          definedAxisTicks={4}
                        />
                      </ChartPanel>
                    </Block>
                  )}
                </BlockContainer>
              )}

              {span && (
                <SpanTransactionsTable
                  span={span}
                  sort={sort}
                  endpoint={endpoint}
                  endpointMethod={endpointMethod}
                />
              )}

              {transaction && span?.group && (
                <SampleList
                  groupId={span.group}
                  transactionName={transaction}
                  transactionMethod={transactionMethod}
                />
              )}
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </StarfishPageFilterContainer>
    </Layout.Page>
  );
}

const FilterOptionsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;
  flex: 1;
`;

type BlockProps = {
  children: React.ReactNode;
  description?: React.ReactNode;
  title?: React.ReactNode;
};

export function Block({title, description, children}: BlockProps) {
  return (
    <BlockWrapper>
      <BlockTitle>
        {title}
        {description && (
          <BlockTooltipContainer>
            <QuestionTooltip size="sm" position="right" title={description} />
          </BlockTooltipContainer>
        )}
      </BlockTitle>
      <BlockContent>{children}</BlockContent>
    </BlockWrapper>
  );
}

const BlockTitle = styled('h3')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  margin-bottom: ${space(1)};
  white-space: nowrap;
`;

const BlockContent = styled('h4')`
  margin: 0;
  font-weight: normal;
`;

const BlockTooltipContainer = styled('span')`
  margin-left: ${space(1)};
`;

export const BlockContainer = styled('div')`
  display: flex;
  & > div:last-child {
    padding-right: ${space(1)};
  }
  padding-bottom: ${space(2)};
`;

const DescriptionContainer = styled('div')`
  width: 100%;
  padding: ${space(1)};
  font-size: 1rem;
  line-height: 1.2;
`;

const DescriptionPanelBody = styled(PanelBody)`
  padding: ${space(2)};
  height: 208px;
`;

const BlockWrapper = styled('div')`
  padding-right: ${space(4)};
  flex: 1;
`;

const DescriptionTitle = styled('h4')`
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.2;
`;

export default SpanSummaryPage;

const getDescriptionLabel = (location: Location, spanMeta: SpanMeta, title?: boolean) => {
  const module = extractRoute(location);
  if (module === 'api') {
    return title ? t('URL Request Summary') : t('URL Request');
  }
  if (module === 'database') {
    return title ? t('Query Summary') : t('Query');
  }

  const spanOp = spanMeta['span.op'];
  let label;
  if (spanOp?.startsWith('http')) {
    label = title ? t('URL Request Summary') : t('URL Request');
  }
  if (spanOp?.startsWith('db')) {
    label = title ? t('Query Summary') : t('Query');
  }
  if (spanOp?.startsWith('serialize')) {
    label = title ? t('Serializer Summary') : t('Serializer');
  }
  if (spanOp?.startsWith('task')) {
    label = title ? t('Task Summary') : t('Task');
  }
  if (!label) {
    label = title ? t('Span Summary') : t('Span Description');
  }
  return label;
};
