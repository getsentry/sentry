import {CSSProperties, Fragment, useCallback, useState} from 'react';
import {browserHistory, Link} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';

import {Button} from 'sentry/components/button';
import GridEditable, {
  COL_WIDTH_UNDEFINED,
  GridColumnHeader,
  GridColumnOrder,
  GridColumnSortBy,
} from 'sentry/components/gridEditable';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Tag} from 'sentry/types';
import {EChartClickHandler, EChartHighlightHandler, Series} from 'sentry/types/echarts';
import {defined} from 'sentry/utils';
import {generateEventSlug} from 'sentry/utils/discover/urls';
import {getShortEventId} from 'sentry/utils/events';
import {getDuration} from 'sentry/utils/formatters';
import {
  PageErrorAlert,
  PageErrorProvider,
} from 'sentry/utils/performance/contexts/pageError';
import {getTransactionDetailsUrl} from 'sentry/utils/performance/urls';
import {generateProfileFlamechartRoute} from 'sentry/utils/profiling/routes';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useRoutes} from 'sentry/utils/useRoutes';
import {PerformanceBadge} from 'sentry/views/performance/browser/webVitals/components/performanceBadge';
import {WebVitalTagsDetailHeader} from 'sentry/views/performance/browser/webVitals/components/webVitalDescription';
import {calculatePerformanceScore} from 'sentry/views/performance/browser/webVitals/utils/calculatePerformanceScore';
import {TransactionSampleRowWithScore} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useProjectWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useProjectWebVitalsQuery';
import {useTransactionSamplesWebVitalsQuery} from 'sentry/views/performance/browser/webVitals/utils/useTransactionSamplesWebVitalsQuery';
import {generateReplayLink} from 'sentry/views/performance/transactionSummary/utils';
import {AVG_COLOR} from 'sentry/views/starfish/colours';
import Chart from 'sentry/views/starfish/components/chart';
import ChartPanel from 'sentry/views/starfish/components/chartPanel';
import DetailPanel from 'sentry/views/starfish/components/detailPanel';

import {PERFORMANCE_SCORE_COLORS} from './utils/performanceScoreColors';
import {scoreToStatus} from './utils/scoreToStatus';
import {useProjectWebVitalsTimeseriesQuery} from './utils/useProjectWebVitalsTimeseriesQuery';

type Column = GridColumnHeader;

const columnOrder: GridColumnOrder[] = [
  {key: 'id', width: COL_WIDTH_UNDEFINED, name: 'Event ID'},
  {key: 'browser', width: COL_WIDTH_UNDEFINED, name: 'Browser'},
  {key: 'replayId', width: COL_WIDTH_UNDEFINED, name: 'Replay'},
  {key: 'profile.id', width: COL_WIDTH_UNDEFINED, name: 'Profile'},
  {key: 'transaction.duration', width: COL_WIDTH_UNDEFINED, name: 'Duration'},
  {key: 'score', width: COL_WIDTH_UNDEFINED, name: 'Performance Score'},
];

const sort: GridColumnSortBy<keyof TransactionSampleRowWithScore> = {
  key: 'score',
  order: 'desc',
};

export function PageOverviewWebVitalsTagDetailPanel({
  tag,
  onClose,
}: {
  onClose: () => void;
  tag?: Tag;
}) {
  const location = useLocation();
  const theme = useTheme();
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const routes = useRoutes();
  const [highlightedSampleId, setHighlightedSampleId] = useState<string | undefined>(
    undefined
  );

  const replayLinkGenerator = generateReplayLink(routes);

  const transaction = location.query.transaction
    ? Array.isArray(location.query.transaction)
      ? location.query.transaction[0]
      : location.query.transaction
    : undefined;

  const {data: projectData, isLoading: projectDataLoading} = useProjectWebVitalsQuery({
    transaction,
    tag,
  });

  const {data: chartSeriesData, isLoading: chartSeriesDataIsLoading} =
    useProjectWebVitalsTimeseriesQuery({transaction, tag});

  const projectScore = calculatePerformanceScore({
    lcp: projectData?.data[0]['p75(measurements.lcp)'] as number,
    fcp: projectData?.data[0]['p75(measurements.fcp)'] as number,
    cls: projectData?.data[0]['p75(measurements.cls)'] as number,
    ttfb: projectData?.data[0]['p75(measurements.ttfb)'] as number,
    fid: projectData?.data[0]['p75(measurements.fid)'] as number,
  });

  const {
    data: samplesTableData,
    isLoading: isSamplesTabledDataLoading,
    isRefetching,
    refetch,
  } = useTransactionSamplesWebVitalsQuery({
    limit: 3,
    transaction: transaction ?? '',
    query: tag ? `${tag.key}:${tag.name}` : undefined,
    enabled: Boolean(tag),
  });

  // Sample Table props
  const tableData: TransactionSampleRowWithScore[] = samplesTableData.sort(
    (a, b) => a.score - b.score
  );

  const renderHeadCell = (col: Column) => {
    if (col.key === 'id' || col.key === 'browser') {
      return <NoOverflow>{col.name}</NoOverflow>;
    }
    return <AlignCenter>{col.name}</AlignCenter>;
  };

  const getFormattedDuration = (value: number | null) => {
    if (value === null) {
      return null;
    }
    if (value < 1000) {
      return getDuration(value / 1000, 0, true);
    }
    return getDuration(value / 1000, 2, true);
  };

  const renderBodyCell = (col: Column, row: TransactionSampleRowWithScore) => {
    const shouldHighlight = row.id === highlightedSampleId;

    const commonProps = {
      style: (shouldHighlight
        ? {textShadow: '0 0 0.5px black'}
        : {}) satisfies CSSProperties,
      onMouseEnter: () => setHighlightedSampleId(row.id),
      onMouseLeave: () => setHighlightedSampleId(undefined),
    };

    const {key} = col;
    if (key === 'score') {
      return (
        <AlignCenter {...commonProps}>
          <PerformanceBadge score={row.score} />
        </AlignCenter>
      );
    }
    if (key === 'browser') {
      return <NoOverflow {...commonProps}>{row[key]}</NoOverflow>;
    }
    if (key === 'id') {
      const eventSlug = generateEventSlug({...row, project: row.projectSlug});
      const eventTarget = getTransactionDetailsUrl(organization.slug, eventSlug);
      return (
        <NoOverflow {...commonProps}>
          <Link to={eventTarget} onClick={onClose}>
            {getShortEventId(row.id)}
          </Link>
        </NoOverflow>
      );
    }
    if (key === 'replayId') {
      const replayTarget =
        row['transaction.duration'] !== null &&
        replayLinkGenerator(
          organization,
          {
            replayId: row.replayId,
            id: row.id,
            'transaction.duration': row['transaction.duration'],
            timestamp: row.timestamp,
          },
          undefined
        );

      return row.replayId && replayTarget ? (
        <AlignCenter {...commonProps}>
          <Link to={replayTarget}>{getShortEventId(row.replayId)}</Link>
        </AlignCenter>
      ) : (
        <AlignCenter {...commonProps}>{' \u2014 '}</AlignCenter>
      );
    }
    if (key === 'profile.id') {
      if (!row.projectSlug || !defined(row['profile.id'])) {
        return <AlignCenter {...commonProps}>{' \u2014 '}</AlignCenter>;
      }
      const target = generateProfileFlamechartRoute({
        orgSlug: organization.slug,
        projectSlug: row.projectSlug,
        profileId: String(row['profile.id']),
      });

      return (
        <NoOverflow>
          <Link to={target} onClick={onClose}>
            {getShortEventId(row['profile.id'])}
          </Link>
        </NoOverflow>
      );
    }
    if (key === 'transaction.duration') {
      return <AlignCenter {...commonProps}>{getFormattedDuration(row[key])}</AlignCenter>;
    }
    return <AlignCenter {...commonProps}>{row[key]}</AlignCenter>;
  };

  // Chart props
  const samplesScatterPlotSeries: Series[] = tableData.map(({timestamp, score, id}) => {
    const color = theme[PERFORMANCE_SCORE_COLORS[scoreToStatus(score)].normal];
    return {
      data: [
        {
          name: timestamp,
          value: score,
        },
      ],
      symbol: 'roundRect',
      color,
      symbolSize: id === highlightedSampleId ? 16 : 12,
      seriesName: id.substring(0, 8),
    };
  });

  const chartSubTitle = pageFilters.selection.datetime.period
    ? t('Last %s', pageFilters.selection.datetime.period)
    : t('Last period');

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const debounceSetHighlightedSpanId = useCallback(
    debounce(id => {
      setHighlightedSampleId(id);
    }, 10),
    []
  );

  const handleChartHighlight: EChartHighlightHandler = e => {
    const {seriesIndex} = e.batch[0];
    const isSample = seriesIndex >= 1;

    if (isSample) {
      const sampleData = samplesScatterPlotSeries?.[seriesIndex - 1]?.data[0];
      const {name: timestamp, value: score} = sampleData;
      const sample = tableData.find(s => s.timestamp === timestamp && s.score === score);
      if (sample) {
        debounceSetHighlightedSpanId(sample.id);
      }
    }
    if (!isSample) {
      debounceSetHighlightedSpanId(undefined);
    }
  };

  const handleChartClick: EChartClickHandler = e => {
    const isSample = e?.componentSubType === 'scatter';
    if (isSample) {
      const [timestamp, score] = e.value as [string, number];
      const sample = tableData.find(s => s.timestamp === timestamp && s.score === score);
      if (sample) {
        const eventSlug = generateEventSlug({...sample, project: sample.projectSlug});
        const eventTarget = getTransactionDetailsUrl(organization.slug, eventSlug);
        browserHistory.push(eventTarget);
      }
    }
  };

  const chartIsLoading =
    chartSeriesDataIsLoading || isSamplesTabledDataLoading || isRefetching;

  const p75TransactionDuration = projectData?.data[0][`p75(transaction.duration)`];
  const subTitle = p75TransactionDuration ? (
    <SubtitleWrapper>
      <span>{getDuration((p75TransactionDuration as number) / 1000, 2, true)}</span>
      <QuestionTooltip
        title={t(
          `The p75(transaction.duration) of the route with %s as %s`,
          tag?.key,
          tag?.name
        )}
        size="xs"
      />
    </SubtitleWrapper>
  ) : (
    <LoadingIndicatorWrapper>
      <LoadingIndicator mini />
    </LoadingIndicatorWrapper>
  );

  return (
    <PageErrorProvider>
      {tag && (
        <DetailPanel detailKey={tag?.key} onClose={onClose}>
          <Fragment>
            <WebVitalTagsDetailHeader
              value={subTitle}
              tag={tag}
              projectScore={projectScore}
              isProjectScoreCalculated={!projectDataLoading}
            />
            <ChartPanel title={t('Performance Score')} subtitle={chartSubTitle}>
              <Chart
                height={180}
                onClick={handleChartClick}
                onHighlight={handleChartHighlight}
                aggregateOutputFormat="integer"
                data={[
                  {
                    data: chartIsLoading ? [] : chartSeriesData.total,
                    seriesName: 'performance score',
                  },
                ]}
                loading={chartIsLoading}
                utc={false}
                chartColors={[AVG_COLOR, 'black']}
                scatterPlot={
                  isSamplesTabledDataLoading || isRefetching
                    ? undefined
                    : samplesScatterPlotSeries
                }
                isLineChart
                definedAxisTicks={4}
              />
            </ChartPanel>
            <GridEditable
              data={tableData}
              isLoading={isSamplesTabledDataLoading || isRefetching}
              columnOrder={columnOrder}
              columnSortBy={[sort]}
              grid={{
                renderHeadCell,
                renderBodyCell,
              }}
              location={location}
            />
            <Button onClick={() => refetch()}>{t('Try Different Samples')}</Button>
          </Fragment>
          <PageErrorAlert />
        </DetailPanel>
      )}
    </PageErrorProvider>
  );
}

const NoOverflow = styled('span')`
  overflow: hidden;
  text-overflow: ellipsis;
`;

const AlignCenter = styled('span')`
  text-align: center;
  width: 100%;
`;

const SubtitleWrapper = styled('span')`
  display: flex;
  align-items: flex-start;
  gap: ${space(0.5)};
`;

const LoadingIndicatorWrapper = styled('span')`
  .loading.mini {
    margin: 10px ${space(0.5)};
  }
`;
