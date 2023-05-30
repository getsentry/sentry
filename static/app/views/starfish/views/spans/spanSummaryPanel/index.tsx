import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import Duration from 'sentry/components/duration';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import Chart from 'sentry/views/starfish/components/chart';
import Detail from 'sentry/views/starfish/components/detailPanel';
import {ReleasePreview} from 'sentry/views/starfish/views/spans/spanSummaryPanel/releasePreview';
import {SpanDescription} from 'sentry/views/starfish/views/spans/spanSummaryPanel/spanDescription';
import {SpanTransactionsTable} from 'sentry/views/starfish/views/spans/spanSummaryPanel/spanTransactionsTable';
import type {Span} from 'sentry/views/starfish/views/spans/spanSummaryPanel/types';
import {useSpanMetrics} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanMetrics';
import {useSpanMetricSeries} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanMetricSeries';
import {
  useSpanFirstSeenEvent,
  useSpanLastSeenEvent,
} from 'sentry/views/starfish/views/spans/spanSummaryPanel/useSpanSeenEvent';

type Props = {
  onClose: () => void;
  span?: Span;
};

export function SpanSummaryPanel({span, onClose}: Props) {
  const theme = useTheme();

  const {data: spanMetrics} = useSpanMetrics(span);
  const {data: spanMetricSeries} = useSpanMetricSeries(span);

  const {data: firstSeenSpanEvent} = useSpanFirstSeenEvent(span);
  const {data: lastSeenSpanEvent} = useSpanLastSeenEvent(span);

  return (
    <Detail detailKey={span?.group_id} onClose={onClose}>
      <Header>{t('Span Summary')}</Header>

      <BlockContainer>
        <Block title={t('First Seen')}>
          <TimeSince date={spanMetrics?.first_seen} />
          {firstSeenSpanEvent?.release && (
            <ReleasePreview release={firstSeenSpanEvent?.release} />
          )}
        </Block>

        <Block title={t('Last Seen')}>
          <TimeSince date={spanMetrics?.last_seen} />
          {lastSeenSpanEvent?.release && (
            <ReleasePreview release={lastSeenSpanEvent?.release} />
          )}
        </Block>

        <Block title={t('Total Spans')}>{spanMetrics?.count}</Block>

        <Block title={t('Total Time')}>
          <Duration
            seconds={spanMetrics?.total_time / 1000}
            fixedDigits={2}
            abbreviation
          />
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
        <Block title={t('SPM')}>
          <Chart
            statsPeriod="24h"
            height={140}
            data={[spanMetricSeries.spm]}
            start=""
            end=""
            loading={false}
            utc={false}
            stacked
            isLineChart
            disableXAxis
            hideYAxisSplitLine
          />
        </Block>

        <Block title={t('Duration')}>
          <Chart
            statsPeriod="24h"
            height={140}
            data={[spanMetricSeries.p50, spanMetricSeries.p95]}
            start=""
            end=""
            loading={false}
            chartColors={theme.charts.getColorPalette(4).slice(3, 5)}
            utc={false}
            stacked
            isLineChart
            disableXAxis
            hideYAxisSplitLine
          />
        </Block>

        {span?.span_operation === 'http.client' ? (
          <Block title={t('Failure Rate')}>
            <Chart
              statsPeriod="24h"
              height={140}
              data={[spanMetricSeries.failure_rate]}
              start=""
              end=""
              loading={false}
              chartColors={[theme.charts.getColorPalette(2)[2]]}
              utc={false}
              stacked
              isLineChart
              disableXAxis
              hideYAxisSplitLine
            />
          </Block>
        ) : null}
      </BlockContainer>

      <BlockContainer>{span && <SpanTransactionsTable span={span} />}</BlockContainer>
    </Detail>
  );
}

type BlockProps = {
  children: React.ReactNode;
  title: React.ReactNode;
};

function Block({title, children}: BlockProps) {
  return (
    <BlockWrapper>
      <BlockTitle>{title}</BlockTitle>
      <BlockContent>{children}</BlockContent>
    </BlockWrapper>
  );
}

const Header = styled('h2')``;

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

const BlockContainer = styled('div')`
  display: flex;
  & > div:last-child {
    padding-right: ${space(1)};
  }
  padding-bottom: ${space(2)};
`;

const BlockWrapper = styled('div')`
  padding-right: ${space(4)};
  flex: 1;
`;
