import {Tooltip} from '@sentry/scraps/tooltip';

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
  rawMetricCounts: RawCounts;
  disabled?: boolean;
}

export function ConfidenceFooter({
  chartInfo,
  hasUserQuery,
  isLoading,
  rawMetricCounts,
  disabled,
}: ConfidenceFooterProps) {
  return (
    <Container>
      <ConfidenceMessage
        isLoading={isLoading}
        hasUserQuery={hasUserQuery}
        rawMetricCounts={rawMetricCounts}
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
  rawMetricCounts: RawCounts;
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  disabled?: boolean;
  isSampled?: boolean | null;
  sampleCount?: number;
  topEvents?: number;
}

function ConfidenceMessage({
  rawMetricCounts,
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
      const matchingMetricsCount =
        sampleCount > 1
          ? t('%s data points', <Count value={sampleCount} />)
          : t('%s data point', <Count value={sampleCount} />);

      if (isTopN) {
        return tct('[matchingMetricsCount] for top [topEvents] groups', {
          matchingMetricsCount,
          topEvents,
        });
      }

      return matchingMetricsCount;
    }

    const matchingMetricsCount =
      sampleCount > 1
        ? t('%s matches', <Count value={sampleCount} />)
        : t('%s match', <Count value={sampleCount} />);

    const totalMetricsCount = defined(rawMetricCounts.highAccuracy.count) ? (
      rawMetricCounts.highAccuracy.count > 1 ? (
        t('%s data points', <Count value={rawMetricCounts.highAccuracy.count} />)
      ) : (
        t('%s data point', <Count value={rawMetricCounts.highAccuracy.count} />)
      )
    ) : (
      <Placeholder width={40} />
    );

    if (isTopN) {
      return tct(
        '[matchingMetricsCount] of [totalMetricsCount] for top [topEvents] groups',
        {
          matchingMetricsCount,
          totalMetricsCount,
          topEvents,
        }
      );
    }

    return tct('[matchingMetricsCount] of [totalMetricsCount]', {
      matchingMetricsCount,
      totalMetricsCount,
    });
  }

  const maybeWarning =
    dataScanned === 'partial' ? tct('[warning] ', {warning: <WarningIcon />}) : null;
  const maybeTooltip =
    dataScanned === 'partial' ? (
      <DownsampledTooltip noSampling={noSampling} hasUserQuery={hasUserQuery} />
    ) : null;

  // no user query means it's showing the total number of metrics scanned
  // so no need to mention how many matched
  if (!hasUserQuery) {
    // partial scans means that we didnt scan all the data so it's useful
    // to mention the total number of metrics available
    if (dataScanned === 'partial') {
      const matchingMetricsCount =
        sampleCount > 1
          ? t('%s samples', <Count value={sampleCount} />)
          : t('%s sample', <Count value={sampleCount} />);

      const totalMetricsCount = defined(rawMetricCounts.highAccuracy.count) ? (
        rawMetricCounts.highAccuracy.count > 1 ? (
          t('%s data points', <Count value={rawMetricCounts.highAccuracy.count} />)
        ) : (
          t('%s data point', <Count value={rawMetricCounts.highAccuracy.count} />)
        )
      ) : (
        <Placeholder width={40} />
      );

      if (isTopN) {
        return tct(
          '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingMetricsCount]] of [totalMetricsCount]',
          {
            maybeWarning,
            topEvents,
            maybeTooltip,
            matchingMetricsCount,
            totalMetricsCount,
          }
        );
      }

      return tct(
        '[maybeWarning]Estimated from [maybeTooltip:[matchingMetricsCount]] of [totalMetricsCount]',
        {
          maybeWarning,
          maybeTooltip,
          matchingMetricsCount,
          totalMetricsCount,
        }
      );
    }

    // otherwise, a full scan was done
    // full scan means we scanned all the data available so no need to repeat that information twice

    const matchingMetricsCount =
      sampleCount > 1
        ? t('%s data points', <Count value={sampleCount} />)
        : t('%s data point', <Count value={sampleCount} />);

    if (isTopN) {
      return tct(
        '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingMetricsCount]]',
        {
          maybeWarning,
          topEvents,
          maybeTooltip,
          matchingMetricsCount,
        }
      );
    }

    return tct('[maybeWarning]Estimated from [maybeTooltip:[matchingMetricsCount]]', {
      maybeWarning,
      maybeTooltip,
      matchingMetricsCount,
    });
  }

  // otherwise, a user query was specified
  // with a user query, it means we should tell the user how many of the scanned metrics
  // matched the user query

  // partial scans means that we didnt scan all the data so it's useful
  // to mention the total number of metrics available
  if (dataScanned === 'partial') {
    const matchingMetricsCount =
      sampleCount > 1
        ? t('%s matches', <Count value={sampleCount} />)
        : t('%s match', <Count value={sampleCount} />);

    const scannedMetricsCount = defined(rawMetricCounts.normal.count) ? (
      rawMetricCounts.normal.count > 1 ? (
        t('%s samples', <Count value={rawMetricCounts.normal.count} />)
      ) : (
        t('%s sample', <Count value={rawMetricCounts.normal.count} />)
      )
    ) : (
      <Placeholder width={40} />
    );

    const totalMetricsCount = defined(rawMetricCounts.highAccuracy.count) ? (
      rawMetricCounts.highAccuracy.count > 1 ? (
        t('%s data points', <Count value={rawMetricCounts.highAccuracy.count} />)
      ) : (
        t('%s data point', <Count value={rawMetricCounts.highAccuracy.count} />)
      )
    ) : (
      <Placeholder width={40} />
    );

    if (isTopN) {
      return tct(
        '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingMetricsCount]] after scanning [scannedMetricsCount] of [totalMetricsCount]',
        {
          maybeWarning,
          topEvents,
          maybeTooltip,
          matchingMetricsCount,
          scannedMetricsCount,
          totalMetricsCount,
        }
      );
    }

    return tct(
      '[maybeWarning]Estimated from [maybeTooltip:[matchingMetricsCount]] after scanning [scannedMetricsCount] of [totalMetricsCount]',
      {
        maybeWarning,
        maybeTooltip,
        matchingMetricsCount,
        scannedMetricsCount,
        totalMetricsCount,
      }
    );
  }

  // otherwise, a full scan was done
  // full scan means we scanned all the data available so no need to repeat that information twice

  const matchingMetricsCount =
    sampleCount > 1
      ? t('%s matches', <Count value={sampleCount} />)
      : t('%s match', <Count value={sampleCount} />);

  const totalMetricsCount = defined(rawMetricCounts.highAccuracy.count) ? (
    rawMetricCounts.highAccuracy.count > 1 ? (
      t('%s data points', <Count value={rawMetricCounts.highAccuracy.count} />)
    ) : (
      t('%s data point', <Count value={rawMetricCounts.highAccuracy.count} />)
    )
  ) : (
    <Placeholder width={40} />
  );

  if (isTopN) {
    return tct(
      '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingMetricsCount]] of [totalMetricsCount]',
      {
        maybeWarning,
        topEvents,
        maybeTooltip,
        matchingMetricsCount,
        totalMetricsCount,
      }
    );
  }

  return tct(
    '[maybeWarning]Estimated from [maybeTooltip:[matchingMetricsCount]] of [totalMetricsCount]',
    {
      maybeWarning,
      maybeTooltip,
      matchingMetricsCount,
      totalMetricsCount,
    }
  );
}

function DownsampledTooltip({
  noSampling,
  hasUserQuery,
  children,
}: {
  hasUserQuery: boolean;
  noSampling: boolean;
  children?: React.ReactNode;
}) {
  return (
    <Tooltip
      title={
        <div>
          {t(
            'The volume of metric data points in this time range is too large for us to do a full scan.'
          )}
          <br />
          <br />
          {hasUserQuery
            ? t(
                'Try reducing the date range, number of projects, or removing filters to attempt scanning all data points.'
              )
            : t(
                'Try reducing the date range or number of projects to attempt scanning all data points.'
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
