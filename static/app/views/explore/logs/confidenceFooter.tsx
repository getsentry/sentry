import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {IconWarning} from 'sentry/icons';
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
  hasUserQuery: boolean;
  isLoading: boolean;
  rawLogCounts: RawLogCounts;
}

export function ConfidenceFooter({
  chartInfo: currentChartInfo,
  hasUserQuery,
  isLoading,
  rawLogCounts,
}: ConfidenceFooterProps) {
  const chartInfo = usePreviouslyLoaded(currentChartInfo, isLoading);
  return (
    <Container>
      <ConfidenceMessage
        isLoading={isLoading}
        hasUserQuery={hasUserQuery}
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
  hasUserQuery: boolean;
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
  hasUserQuery,
  isLoading,
  isSampled,
}: ConfidenceMessageProps) {
  const isTopN = defined(topEvents) && topEvents > 1;

  if (!defined(sampleCount) || isLoading) {
    return (
      <OffsetContainer>
        <Placeholder width={180} />
      </OffsetContainer>
    );
  }

  const noSampling = defined(isSampled) && !isSampled;
  const matchingLogsCount =
    sampleCount > 1
      ? t('%s matches', <Count value={sampleCount} />)
      : t('%s match', <Count value={sampleCount} />);
  const downsampledLogsCount = rawLogCounts.normal.count ? (
    rawLogCounts.normal.count > 1 ? (
      t('%s samples', <Count value={rawLogCounts.normal.count} />)
    ) : (
      t('%s sample', <Count value={rawLogCounts.normal.count} />)
    )
  ) : (
    <OffsetContainer>
      <Placeholder width={40} />
    </OffsetContainer>
  );
  const allLogsCount = rawLogCounts.highAccuracy.count ? (
    rawLogCounts.highAccuracy.count > 1 ? (
      t('%s logs', <Count value={rawLogCounts.highAccuracy.count} />)
    ) : (
      t('%s log', <Count value={rawLogCounts.highAccuracy.count} />)
    )
  ) : (
    <OffsetContainer>
      <Placeholder width={40} />
    </OffsetContainer>
  );

  if (dataScanned === 'full') {
    if (!hasUserQuery) {
      if (isTopN) {
        return tct('Log count for top [topEvents] groups: [matchingLogsCount]', {
          topEvents,
          matchingLogsCount: <Count value={sampleCount} />,
        });
      }

      return tct('Log count: [matchingLogsCount]', {
        matchingLogsCount: <Count value={sampleCount} />,
      });
    }

    // For logs, if the full data was scanned, we can assume that no
    // extrapolation happened and we should remove mentions of extrapolation.
    if (isTopN) {
      return tct('[matchingLogsCount] for top [topEvents] groups in [allLogsCount]', {
        topEvents,
        matchingLogsCount,
        allLogsCount,
      });
    }

    return tct('[matchingLogsCount] in [allLogsCount]', {
      matchingLogsCount,
      allLogsCount,
    });
  }

  const downsampledTooltip = <DownsampledTooltip noSampling={noSampling} />;

  const warning = (
    <OffsetContainer>
      <IconWarning size="sm" />
    </OffsetContainer>
  );

  if (isTopN) {
    return tct(
      '[warning] Extrapolated from [matchingLogsCount] for top [topEvents] groups after scanning [tooltip:[downsampledLogsCount] of [allLogsCount]]',
      {
        warning,
        topEvents,
        matchingLogsCount,
        downsampledLogsCount,
        allLogsCount,
        tooltip: downsampledTooltip,
      }
    );
  }

  return tct(
    '[warning] Extrapolated from [matchingLogsCount] after scanning [tooltip:[downsampledLogsCount] of [allLogsCount]]',
    {
      warning,
      matchingLogsCount,
      downsampledLogsCount,
      allLogsCount,
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

const OffsetContainer = styled('span')`
  position: relative;
  top: 2px;
`;
