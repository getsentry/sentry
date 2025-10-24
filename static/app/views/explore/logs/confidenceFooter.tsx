import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {t, tct} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {
  Container,
  usePreviouslyLoaded,
} from 'sentry/views/explore/components/chart/chartFooter';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import type {RawLogCounts} from 'sentry/views/explore/logs/useLogsQuery';

interface ConfidenceFooterProps {
  chartInfo: ChartInfo;
  isLoading: boolean;
  rawLogCounts: RawLogCounts;
}

export function ConfidenceFooter({
  chartInfo: currentChartInfo,
  isLoading,
  rawLogCounts,
}: ConfidenceFooterProps) {
  const chartInfo = usePreviouslyLoaded(currentChartInfo, isLoading);
  return (
    <Container>
      <ConfidenceMessage
        isLoading={isLoading}
        rawLogCounts={rawLogCounts}
        confidence={chartInfo.confidence}
        dataScanned={chartInfo.dataScanned}
        isSampled={chartInfo.isSampled}
        sampleCount={chartInfo.sampleCount}
        topEvents={chartInfo.topEvents}
      />
    </Container>
  );
}

interface ConfidenceMessageProps {
  isLoading: boolean;
  rawLogCounts: RawLogCounts;
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  isSampled?: boolean | null;
  sampleCount?: number;
  topEvents?: number;
}

function ConfidenceMessage({
  rawLogCounts,
  sampleCount,
  dataScanned,
  confidence: _confidence,
  topEvents,
  isLoading,
  isSampled,
}: ConfidenceMessageProps) {
  const isTopN = defined(topEvents) && topEvents > 1;

  if (!defined(sampleCount) || isLoading) {
    return <Placeholder width={180} />;
  }

  const noSampling = defined(isSampled) && !isSampled;
  const matchingLogsCount = <Count value={sampleCount} />;
  const downsampledLogsCount = rawLogCounts.normal.count ? (
    <Count value={rawLogCounts.normal.count} />
  ) : (
    <Placeholder width={40} />
  );
  const allLogsCount = rawLogCounts.highAccuracy.count ? (
    <Count value={rawLogCounts.highAccuracy.count} />
  ) : (
    <Placeholder width={40} />
  );
  const suffix = rawLogCounts.highAccuracy.count ? t('logs') : '';

  if (dataScanned === 'full') {
    // For logs, if the full data was scanned, we can assume that no
    // extrapolation happened and we should remove mentions of extrapolation.
    if (isTopN) {
      return tct(
        '[matchingLogsCount] matching logs for top [topEvents] groups after scanning [allLogsCount] [suffix]',
        {
          topEvents,
          matchingLogsCount,
          allLogsCount,
          suffix,
        }
      );
    }

    return tct(
      '[matchingLogsCount] matching logs after scanning [allLogsCount] [suffix]',
      {
        matchingLogsCount,
        allLogsCount,
        suffix,
      }
    );
  }

  const downsampledTooltip = <DownsampledTooltip noSampling={noSampling} />;

  if (isTopN) {
    return tct(
      'Extrapolated from [matchingLogsCount] matching logs for top [topEvents] groups after scanning [tooltip:[downsampledLogsCount] of [allLogsCount] [suffix]]',
      {
        topEvents,
        matchingLogsCount,
        downsampledLogsCount,
        allLogsCount,
        suffix,
        tooltip: downsampledTooltip,
      }
    );
  }

  return tct(
    'Extrapolated from [matchingLogsCount] matching logs after scanning [tooltip:[downsampledLogsCount] of [allLogsCount] [suffix]]',
    {
      matchingLogsCount,
      downsampledLogsCount,
      allLogsCount,
      suffix,
      tooltip: downsampledTooltip,
    }
  );
}

function DownsampledTooltip({
  noSampling,
  children,
}: {
  noSampling: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Tooltip
      title={
        <div>
          {t(
            'The volume of logs in this time range is too large for us to do a full scan.'
          )}
          <br />
          {t(
            'Try reducing the date range or number of projects to attempt scanning all logs.'
          )}
        </div>
      }
      disabled={noSampling}
      maxWidth={270}
      showUnderline
    >
      {children}
    </Tooltip>
  );
}

const Placeholder = styled('div')<{width: number}>`
  display: inline-block;
  width: ${p => p.width}px;
  height: ${p => p.theme.fontSize.md};
  border-radius: ${p => p.theme.borderRadius};
  background-color: ${p => p.theme.backgroundTertiary};
`;
