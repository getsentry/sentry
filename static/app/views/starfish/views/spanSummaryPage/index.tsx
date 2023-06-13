import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import {Panel, PanelBody} from 'sentry/components/panels';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {P95_COLOR, THROUGHPUT_COLOR} from 'sentry/views/starfish/colours';
import Chart, {useSynchronizeCharts} from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import {SpanDescription} from 'sentry/views/starfish/components/spanDescription';
import DurationCell from 'sentry/views/starfish/components/tableCells/durationCell';
import ThroughputCell from 'sentry/views/starfish/components/tableCells/throughputCell';
import {TimeSpentCell} from 'sentry/views/starfish/components/tableCells/timeSpentCell';
import {useSpanMeta} from 'sentry/views/starfish/queries/useSpanMeta';
import {useSpanMetrics} from 'sentry/views/starfish/queries/useSpanMetrics';
import {useSpanMetricsSeries} from 'sentry/views/starfish/queries/useSpanMetricsSeries';
import {DataTitles} from 'sentry/views/starfish/views/spans/types';
import {SampleList} from 'sentry/views/starfish/views/spanSummaryPage/sampleList';
import {SpanTransactionsTable} from 'sentry/views/starfish/views/spanSummaryPage/spanTransactionsTable';

type Props = {
  location: Location;
} & RouteComponentProps<{groupId: string}, {transaction: string}>;

function SpanSummaryPage({params, location}: Props) {
  const {groupId} = params;
  const {transaction} = location.query;

  const {data: spanMetas} = useSpanMeta(
    groupId,
    undefined,
    'span-summary-page-span-meta'
  );
  // TODO: Span meta might in theory return more than one row! In that case, we
  // need to indicate in the UI that more than one set of meta corresponds to
  // the span group
  const span = {
    group: groupId,
    ...spanMetas?.[0],
  };

  const {data: spanMetrics} = useSpanMetrics(
    {group: groupId},
    undefined,
    ['sps()', 'sum(span.duration)', 'p95(span.duration)', 'time_spent_percentage()'],
    'span-summary-page-metrics'
  );

  const {isLoading: areSpanMetricsSeriesLoading, data: spanMetricsSeriesData} =
    useSpanMetricsSeries(
      {group: groupId},
      undefined,
      ['p95(span.duration)', 'sps()'],
      'sidebar-span-metrics'
    );

  useSynchronizeCharts([!areSpanMetricsSeriesLoading]);

  return (
    <Layout.Page>
      <PageFiltersContainer>
        <PageErrorProvider>
          <Layout.Header>
            <Layout.HeaderContent>
              <Layout.Title> Span Summary </Layout.Title>
            </Layout.HeaderContent>{' '}
          </Layout.Header>
          <Layout.Body>
            <Layout.Main fullWidth>
              <PageErrorAlert />
              <FilterOptionsContainer>
                <DatePageFilter alignDropdown="left" />
              </FilterOptionsContainer>
              <BlockContainer>
                <Block title={t('Operation')}>{span?.['span.op']}</Block>
                <Block
                  title={t('Throughput')}
                  description={t('Throughput of this span per second')}
                >
                  <ThroughputCell throughputPerSecond={spanMetrics?.['sps()']} />
                </Block>
                <Block title={t('Duration')} description={t('Time spent in this span')}>
                  <DurationCell milliseconds={spanMetrics?.['p95(span.duration)']} />
                </Block>
                <Block
                  title={t('Time Spent')}
                  description={t(
                    'Time spent in this span as a proportion of total application time'
                  )}
                >
                  <TimeSpentCell
                    timeSpentPercentage={spanMetrics?.['time_spent_percentage()']}
                    totalSpanTime={spanMetrics?.['sum(span.duration)']}
                  />
                </Block>
              </BlockContainer>

              {span?.['span.description'] && (
                <BlockContainer>
                  <Block>
                    <Panel>
                      <PanelBody>
                        <DescriptionContainer>
                          <SpanDescription spanMeta={spanMetas?.[0]} />
                        </DescriptionContainer>
                      </PanelBody>
                    </Panel>
                  </Block>

                  <Block>
                    <ChartPanel title={DataTitles.throughput}>
                      <Chart
                        statsPeriod="24h"
                        height={140}
                        data={[spanMetricsSeriesData?.['sps()']]}
                        start=""
                        end=""
                        loading={areSpanMetricsSeriesLoading}
                        utc={false}
                        chartColors={[THROUGHPUT_COLOR]}
                        isLineChart
                        definedAxisTicks={4}
                      />
                    </ChartPanel>
                  </Block>

                  <Block>
                    <ChartPanel title={DataTitles.p95}>
                      <Chart
                        statsPeriod="24h"
                        height={140}
                        data={[spanMetricsSeriesData?.['p95(span.duration)']]}
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
                </BlockContainer>
              )}

              {span && <SpanTransactionsTable span={span} />}

              {transaction && span?.group && (
                <SampleList groupId={span.group} transactionName={transaction} />
              )}
            </Layout.Main>
          </Layout.Body>
        </PageErrorProvider>
      </PageFiltersContainer>
    </Layout.Page>
  );
}

const FilterOptionsContainer = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;
  margin-bottom: ${space(2)};
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
`;

const BlockWrapper = styled('div')`
  padding-right: ${space(4)};
  flex: 1;
`;

export default SpanSummaryPage;
