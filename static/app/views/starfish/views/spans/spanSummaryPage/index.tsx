import {RouteComponentProps} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import MarkLine from 'sentry/components/charts/components/markLine';
import DatePageFilter from 'sentry/components/datePageFilter';
import * as Layout from 'sentry/components/layouts/thirds';
import PageFiltersContainer from 'sentry/components/organizations/pageFilters/container';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {formatPercentage} from 'sentry/utils/formatters';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {
  DURATION_COLOR,
  ERRORS_COLOR,
  THROUGHPUT_COLOR,
} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import {Block, BlockContainer} from 'sentry/views/starfish/views/spans/spanSummaryPanel';
import {ReleasePreview} from 'sentry/views/starfish/views/spans/spanSummaryPanel/releasePreview';
import {SpanDescription} from 'sentry/views/starfish/views/spans/spanSummaryPanel/spanDescription';
import {SpanTransactionsTable} from 'sentry/views/starfish/views/spans/spanSummaryPanel/spanTransactionsTable';
import {useApplicationMetrics} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useApplicationMetrics';
import {useSpanById} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanById';
import {useSpanMetrics} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanMetrics';
import {useSpanMetricSeries} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanMetricSeries';
import {
  useSpanFirstSeenEvent,
  useSpanLastSeenEvent,
} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanSeenEvent';

type Props = {
  location: Location;
} & RouteComponentProps<{groupId: string}, {}>;

function SpanSummaryPage({params}: Props) {
  const {groupId} = params;

  const theme = useTheme();

  const {data: span} = useSpanById(groupId, 'span-summary-page');
  const {data: applicationMetrics} = useApplicationMetrics();
  const {data: spanMetrics} = useSpanMetrics({group_id: groupId});
  const {data: spanMetricSeries} = useSpanMetricSeries(span);
  const {data: firstSeenSpanEvent} = useSpanFirstSeenEvent({group_id: groupId});
  const {data: lastSeenSpanEvent} = useSpanLastSeenEvent({group_id: groupId});

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
                <Block
                  title={t('First Seen')}
                  description={t(
                    'The first time this span was ever seen in the current retention window'
                  )}
                >
                  <TimeSince date={spanMetrics?.first_seen} />
                  {firstSeenSpanEvent?.release && (
                    <ReleasePreview release={firstSeenSpanEvent?.release} />
                  )}
                </Block>

                <Block
                  title={t('Last Seen')}
                  description={t('The most recent time this span was seen')}
                >
                  <TimeSince date={spanMetrics?.last_seen} />
                  {lastSeenSpanEvent?.release && (
                    <ReleasePreview release={lastSeenSpanEvent?.release} />
                  )}
                </Block>

                <Block
                  title={t('Total Spans')}
                  description={t(
                    'The total number of times this span was seen in all time'
                  )}
                >
                  {spanMetrics?.count}
                </Block>

                <Block
                  title={t('App Impact')}
                  description={t(
                    'The total exclusive time taken up by this span vs. entire application'
                  )}
                >
                  {formatPercentage(
                    spanMetrics?.total_time / applicationMetrics?.total_time
                  )}
                </Block>
              </BlockContainer>
              <BlockContainer>
                {span && (
                  <Block title={t('Description')}>
                    <SpanDescription span={span} />
                  </Block>
                )}
              </BlockContainer>
              <BlockContainer>
                <Block
                  title={t('Span Throughput (SPM)')}
                  description={t('Spans per minute')}
                >
                  <Chart
                    statsPeriod="24h"
                    height={140}
                    data={[
                      {
                        ...spanMetricSeries.spm,
                        markLine: spanMetrics?.p50
                          ? MarkLine({
                              silent: true,
                              animation: false,
                              lineStyle: {color: theme.blue300, type: 'dotted'},
                              data: [
                                {
                                  yAxis: spanMetrics.spm,
                                },
                              ],
                              label: {
                                show: true,
                                position: 'insideStart',
                              },
                            })
                          : undefined,
                      },
                    ]}
                    start=""
                    end=""
                    loading={false}
                    chartColors={[THROUGHPUT_COLOR]}
                    utc={false}
                    stacked
                    isLineChart
                    disableXAxis
                    hideYAxisSplitLine
                  />
                </Block>

                <Block title={t('Span Duration (p50)')} description={t('Exclusive time')}>
                  <Chart
                    statsPeriod="24h"
                    height={140}
                    data={[
                      {
                        ...spanMetricSeries.p50,
                        markLine: spanMetrics?.p50
                          ? MarkLine({
                              silent: true,
                              animation: false,
                              lineStyle: {color: theme.blue300, type: 'dotted'},
                              data: [
                                {
                                  yAxis: spanMetrics.p50,
                                },
                              ],
                              label: {
                                show: true,
                                position: 'insideStart',
                              },
                            })
                          : undefined,
                      },
                    ]}
                    start=""
                    end=""
                    loading={false}
                    chartColors={[DURATION_COLOR]}
                    utc={false}
                    stacked
                    isLineChart
                    disableXAxis
                    hideYAxisSplitLine
                  />
                </Block>

                {span?.span_operation === 'http.client' ? (
                  <Block title={t('Failure Rate')} description={t('Non-200 HTTP status')}>
                    <Chart
                      statsPeriod="24h"
                      height={140}
                      data={[spanMetricSeries.failure_rate]}
                      start=""
                      end=""
                      loading={false}
                      chartColors={[ERRORS_COLOR]}
                      utc={false}
                      stacked
                      isLineChart
                      disableXAxis
                      hideYAxisSplitLine
                    />
                  </Block>
                ) : null}
              </BlockContainer>
              {span && <SpanTransactionsTable span={span} />}
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

export default SpanSummaryPage;
