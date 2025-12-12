import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {t, tct} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {Container} from 'sentry/views/explore/components/chart/chartFooter';
import {
  Placeholder,
  WarningIcon,
} from 'sentry/views/explore/components/chart/placeholder';
import type {ChartInfo} from 'sentry/views/explore/components/chart/types';
import type {RawCounts} from 'sentry/views/explore/useRawCounts';

interface ConfidenceFooterProps {
  chartInfo: ChartInfo;
  hasUserQuery: boolean;
  isLoading: boolean;
  rawLogCounts: RawCounts;
  disabled?: boolean;
}

export function ConfidenceFooter({
  chartInfo,
  hasUserQuery,
  isLoading,
  rawLogCounts,
  disabled,
}: ConfidenceFooterProps) {
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
        disabled={disabled}
      />
    </Container>
  );
}

interface ConfidenceMessageProps {
  hasUserQuery: boolean;
  isLoading: boolean;
  rawLogCounts: RawCounts;
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  disabled?: boolean;
  isSampled?: boolean | null;
  sampleCount?: number;
  topEvents?: number;
}

function ConfidenceMessage({
  rawLogCounts,
  sampleCount,
  dataScanned,
  confidence: _confidence,
  disabled,
  topEvents,
  hasUserQuery,
  isLoading,
  isSampled,
}: ConfidenceMessageProps) {
  if (disabled) {
    return <Placeholder width={0} />;
  }

  if (isLoading || !defined(sampleCount)) {
    return <Placeholder width={180} />;
  }

  const isTopN = defined(topEvents) && topEvents > 1;
  const noSampling = defined(isSampled) && !isSampled;

  // No sampling happened, so don't mention estimations.
  if (noSampling) {
    if (!hasUserQuery) {
      const matchingLogsCount =
        sampleCount > 1
          ? t('%s logs', <Count value={sampleCount} />)
          : t('%s log', <Count value={sampleCount} />);

      if (isTopN) {
        return tct('[matchingLogsCount] for top [topEvents] groups', {
          matchingLogsCount,
          topEvents,
        });
      }

      return matchingLogsCount;
    }

    const matchingLogsCount =
      sampleCount > 1
        ? t('%s matches', <Count value={sampleCount} />)
        : t('%s match', <Count value={sampleCount} />);

    const totalLogsCount = defined(rawLogCounts.highAccuracy.count) ? (
      rawLogCounts.highAccuracy.count > 1 ? (
        t('%s logs', <Count value={rawLogCounts.highAccuracy.count} />)
      ) : (
        t('%s log', <Count value={rawLogCounts.highAccuracy.count} />)
      )
    ) : (
      <Placeholder width={40} />
    );

    if (isTopN) {
      return tct('[matchingLogsCount] of [totalLogsCount] for top [topEvents] groups', {
        matchingLogsCount,
        totalLogsCount,
        topEvents,
      });
    }

    return tct('[matchingLogsCount] of [totalLogsCount]', {
      matchingLogsCount,
      totalLogsCount,
    });
  }

  const maybeWarning =
    dataScanned === 'partial' ? tct('[warning] ', {warning: <WarningIcon />}) : null;
  const maybeTooltip =
    dataScanned === 'partial' ? <DownsampledTooltip noSampling={noSampling} /> : null;

  // no user query means it's showing the total number of logs scanned
  // so no need to mention how many matched
  if (!hasUserQuery) {
    // partial scans means that we didnt scan all the data so it's useful
    // to mention the total number of logs available
    if (dataScanned === 'partial') {
      const matchingLogsCount =
        sampleCount > 1
          ? t('%s samples', <Count value={sampleCount} />)
          : t('%s sample', <Count value={sampleCount} />);

      const totalLogsCount = defined(rawLogCounts.highAccuracy.count) ? (
        rawLogCounts.highAccuracy.count > 1 ? (
          t('%s logs', <Count value={rawLogCounts.highAccuracy.count} />)
        ) : (
          t('%s log', <Count value={rawLogCounts.highAccuracy.count} />)
        )
      ) : (
        <Placeholder width={40} />
      );

      if (isTopN) {
        return tct(
          '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingLogsCount]] of [totalLogsCount]',
          {
            maybeWarning,
            topEvents,
            maybeTooltip,
            matchingLogsCount,
            totalLogsCount,
          }
        );
      }

      return tct(
        '[maybeWarning]Estimated from [maybeTooltip:[matchingLogsCount]] of [totalLogsCount]',
        {
          maybeWarning,
          maybeTooltip,
          matchingLogsCount,
          totalLogsCount,
        }
      );
    }

    // otherwise, a full scan was done
    // full scan means we scanned all the data available so no need to repeat that information twice

    const matchingLogsCount =
      sampleCount > 1
        ? t('%s logs', <Count value={sampleCount} />)
        : t('%s log', <Count value={sampleCount} />);

    if (isTopN) {
      return tct(
        '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingLogsCount]]',
        {
          maybeWarning,
          topEvents,
          maybeTooltip,
          matchingLogsCount,
        }
      );
    }

    return tct('[maybeWarning]Estimated from [maybeTooltip:[matchingLogsCount]]', {
      maybeWarning,
      maybeTooltip,
      matchingLogsCount,
    });
  }

  // otherwise, a user query was specified
  // with a user query, it means we should tell the user how many of the scanned logs
  // matched the user query

  // partial scans means that we didnt scan all the data so it's useful
  // to mention the total number of logs available
  if (dataScanned === 'partial') {
    const matchingLogsCount =
      sampleCount > 1
        ? t('%s matches', <Count value={sampleCount} />)
        : t('%s match', <Count value={sampleCount} />);

    const scannedLogsCount = defined(rawLogCounts.normal.count) ? (
      rawLogCounts.normal.count > 1 ? (
        t('%s samples', <Count value={rawLogCounts.normal.count} />)
      ) : (
        t('%s sample', <Count value={rawLogCounts.normal.count} />)
      )
    ) : (
      <Placeholder width={40} />
    );

    const totalLogsCount = defined(rawLogCounts.highAccuracy.count) ? (
      rawLogCounts.highAccuracy.count > 1 ? (
        t('%s logs', <Count value={rawLogCounts.highAccuracy.count} />)
      ) : (
        t('%s log', <Count value={rawLogCounts.highAccuracy.count} />)
      )
    ) : (
      <Placeholder width={40} />
    );

    if (isTopN) {
      return tct(
        '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingLogsCount]] after scanning [scannedLogsCount] of [totalLogsCount]',
        {
          maybeWarning,
          topEvents,
          maybeTooltip,
          matchingLogsCount,
          scannedLogsCount,
          totalLogsCount,
        }
      );
    }

    return tct(
      '[maybeWarning]Estimated from [maybeTooltip:[matchingLogsCount]] after scanning [scannedLogsCount] of [totalLogsCount]',
      {
        maybeWarning,
        maybeTooltip,
        matchingLogsCount,
        scannedLogsCount,
        totalLogsCount,
      }
    );
  }

  // otherwise, a full scan was done
  // full scan means we scanned all the data available so no need to repeat that information twice

  const matchingLogsCount =
    sampleCount > 1
      ? t('%s matches', <Count value={sampleCount} />)
      : t('%s match', <Count value={sampleCount} />);

  const totalLogsCount = defined(rawLogCounts.highAccuracy.count) ? (
    rawLogCounts.highAccuracy.count > 1 ? (
      t('%s logs', <Count value={rawLogCounts.highAccuracy.count} />)
    ) : (
      t('%s log', <Count value={rawLogCounts.highAccuracy.count} />)
    )
  ) : (
    <Placeholder width={40} />
  );

  if (isTopN) {
    return tct(
      '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingLogsCount]] of [totalLogsCount]',
      {
        maybeWarning,
        topEvents,
        maybeTooltip,
        matchingLogsCount,
        totalLogsCount,
      }
    );
  }

  return tct(
    '[maybeWarning]Estimated from [maybeTooltip:[matchingLogsCount]] of [totalLogsCount]',
    {
      maybeWarning,
      maybeTooltip,
      matchingLogsCount,
      totalLogsCount,
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
