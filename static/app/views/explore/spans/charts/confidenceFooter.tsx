import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {t, tct} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {
  Placeholder,
  WarningIcon,
} from 'sentry/views/explore/components/chart/placeholder';
import type {RawCounts} from 'sentry/views/explore/useRawCounts';

type Props = {
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  extrapolate?: boolean;
  isLoading?: boolean;
  isSampled?: boolean | null;
  rawSpanCounts?: RawCounts;
  sampleCount?: number;
  topEvents?: number;
  userQuery?: string;
};

export function ConfidenceFooter(props: Props) {
  return <Container>{confidenceMessage(props)}</Container>;
}

function confidenceMessage({
  dataScanned,
  extrapolate,
  rawSpanCounts,
  sampleCount,
  confidence,
  topEvents,
  isSampled,
  isLoading,
  userQuery,
}: Props) {
  if (isLoading || !defined(sampleCount)) {
    return <Placeholder width={180} />;
  }

  const isTopN = defined(topEvents) && topEvents > 1;
  const noSampling = defined(isSampled) && !isSampled;

  const maybeWarning =
    confidence === 'low' ? tct('[warning] ', {warning: <WarningIcon />}) : null;
  const maybeTooltip =
    confidence === 'low' ? (
      <_LowAccuracyFullTooltip
        noSampling={noSampling}
        dataScanned={dataScanned}
        userQuery={userQuery}
      />
    ) : null;

  // The multi query mode does not fetch the raw span counts
  // so make sure to have a backup when this happens.
  if (!defined(rawSpanCounts)) {
    const matchingSpansCount =
      sampleCount === 1
        ? t('%s span', <Count value={sampleCount} />)
        : t('%s spans', <Count value={sampleCount} />);

    if (isTopN) {
      return tct(
        '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingSpansCount]]',
        {
          maybeWarning,
          topEvents,
          maybeTooltip,
          matchingSpansCount,
        }
      );
    }

    return tct('[maybeWarning]Estimated from [maybeTooltip:[matchingSpansCount]]', {
      maybeWarning,
      maybeTooltip,
      matchingSpansCount,
    });
  }

  if (
    // Extrapolation disabled, so don't mention estimations.
    (defined(extrapolate) && !extrapolate) ||
    // No sampling happened, so don't mention estimations.
    noSampling
  ) {
    if (!userQuery) {
      const matchingSpansCount =
        sampleCount > 1
          ? t('%s spans', <Count value={sampleCount} />)
          : t('%s span', <Count value={sampleCount} />);

      if (isTopN) {
        return tct('[matchingSpansCount] for top [topEvents] groups', {
          topEvents,
          matchingSpansCount,
        });
      }

      return matchingSpansCount;
    }

    const matchingSpansCount =
      sampleCount > 1
        ? t('%s matches', <Count value={sampleCount} />)
        : t('%s match', <Count value={sampleCount} />);

    const totalSpansCount = defined(rawSpanCounts.highAccuracy.count) ? (
      rawSpanCounts.highAccuracy.count > 1 ? (
        t('%s spans', <Count value={rawSpanCounts.highAccuracy.count} />)
      ) : (
        t('%s span', <Count value={rawSpanCounts.highAccuracy.count} />)
      )
    ) : (
      <Placeholder width={40} />
    );

    if (isTopN) {
      return tct('[matchingSpansCount] of [totalSpansCount] for top [topEvents] groups', {
        matchingSpansCount,
        totalSpansCount,
        topEvents,
      });
    }

    return tct('[matchingSpansCount] of [totalSpansCount]', {
      matchingSpansCount,
      totalSpansCount,
    });
  }

  // no user query means it's showing the total number of spans scanned
  // so no need to mention how many matched
  if (!userQuery) {
    // partial scans means that we didnt scan all the data so it's useful
    // to mention the total number of spans available
    if (dataScanned === 'partial') {
      const matchingSpansCount =
        sampleCount > 1
          ? t('%s samples', <Count value={sampleCount} />)
          : t('%s sample', <Count value={sampleCount} />);

      const totalSpansCount = defined(rawSpanCounts.highAccuracy.count) ? (
        rawSpanCounts.highAccuracy.count > 1 ? (
          t('%s spans', <Count value={rawSpanCounts.highAccuracy.count} />)
        ) : (
          t('%s span', <Count value={rawSpanCounts.highAccuracy.count} />)
        )
      ) : (
        <Placeholder width={40} />
      );

      if (isTopN) {
        return tct(
          '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingSpansCount]] of [totalSpansCount]',
          {
            maybeWarning,
            topEvents,
            maybeTooltip,
            matchingSpansCount,
            totalSpansCount,
          }
        );
      }

      return tct(
        '[maybeWarning]Estimated from [maybeTooltip:[matchingSpansCount]] of [totalSpansCount]',
        {
          maybeWarning,
          maybeTooltip,
          matchingSpansCount,
          totalSpansCount,
        }
      );
    }

    // otherwise, a full scan was done
    // full scan means we scanned all the data available so no need to repeat that information twice

    const matchingSpansCount =
      sampleCount > 1
        ? t('%s spans', <Count value={sampleCount} />)
        : t('%s span', <Count value={sampleCount} />);

    if (isTopN) {
      return tct(
        '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingSpansCount]]',
        {
          maybeWarning,
          maybeTooltip,
          topEvents,
          matchingSpansCount,
        }
      );
    }

    return tct('[maybeWarning]Estimated from [maybeTooltip:[matchingSpansCount]]', {
      maybeWarning,
      maybeTooltip,
      matchingSpansCount,
    });
  }

  // otherwise, a user query was specified
  // with a user query, it means we should tell the user how many of the scanned spans
  // matched the user query

  // partial scans means that we didnt scan all the data so it's useful
  // to mention the total number of spans available
  if (dataScanned === 'partial') {
    const matchingSpansCount =
      sampleCount > 1
        ? t('%s matches', <Count value={sampleCount} />)
        : t('%s match', <Count value={sampleCount} />);

    const scannedSpansCount = defined(rawSpanCounts.normal.count) ? (
      rawSpanCounts.normal.count > 1 ? (
        t('%s samples', <Count value={rawSpanCounts.normal.count} />)
      ) : (
        t('%s sample', <Count value={rawSpanCounts.normal.count} />)
      )
    ) : (
      <Placeholder width={40} />
    );

    const totalSpansCount = defined(rawSpanCounts.highAccuracy.count) ? (
      rawSpanCounts.highAccuracy.count > 1 ? (
        t('%s spans', <Count value={rawSpanCounts.highAccuracy.count} />)
      ) : (
        t('%s span', <Count value={rawSpanCounts.highAccuracy.count} />)
      )
    ) : (
      <Placeholder width={40} />
    );

    if (isTopN) {
      return tct(
        '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingSpansCount]] after scanning [scannedSpansCount] of [totalSpansCount]',
        {
          maybeWarning,
          maybeTooltip,
          matchingSpansCount,
          scannedSpansCount,
          totalSpansCount,
          topEvents,
        }
      );
    }

    return tct(
      '[maybeWarning]Estimated from [maybeTooltip:[matchingSpansCount]] after scanning [scannedSpansCount] of [totalSpansCount]',
      {
        maybeWarning,
        maybeTooltip,
        matchingSpansCount,
        scannedSpansCount,
        totalSpansCount,
      }
    );
  }

  // otherwise, a full scan was done
  // full scan means we scanned all the data available so no need to repeat that information twice

  const matchingSpansCount =
    sampleCount > 1
      ? t('%s matches', <Count value={sampleCount} />)
      : t('%s match', <Count value={sampleCount} />);

  const totalSpansCount = defined(rawSpanCounts.highAccuracy.count) ? (
    rawSpanCounts.highAccuracy.count > 1 ? (
      t('%s spans', <Count value={rawSpanCounts.highAccuracy.count} />)
    ) : (
      t('%s span', <Count value={rawSpanCounts.highAccuracy.count} />)
    )
  ) : (
    <Placeholder width={40} />
  );

  if (isTopN) {
    return tct(
      '[maybeWarning]Estimated for top [topEvents] groups from [maybeTooltip:[matchingSpansCount]] of [totalSpansCount]',
      {
        maybeWarning,
        topEvents,
        maybeTooltip,
        matchingSpansCount,
        totalSpansCount,
      }
    );
  }

  return tct(
    '[maybeWarning]Estimated from [maybeTooltip:[matchingSpansCount]] of [totalSpansCount]',
    {
      maybeWarning,
      maybeTooltip,
      matchingSpansCount,
      totalSpansCount,
    }
  );
}

function _LowAccuracyFullTooltip({
  noSampling,
  children,
  dataScanned,
  userQuery,
}: {
  noSampling: boolean;
  children?: React.ReactNode;
  dataScanned?: 'full' | 'partial';
  userQuery?: string;
}) {
  return (
    <Tooltip
      title={
        <div>
          {t(
            'You may not have enough span samples for a high accuracy estimation of your query.'
          )}
          <br />
          <br />
          {dataScanned === 'partial' && userQuery
            ? t(
                "You can try adjusting your query by narrowing the date range, removing filters or increasing the chart's time interval."
              )
            : dataScanned === 'partial'
              ? t(
                  "You can try adjusting your query by narrowing the date range or increasing the chart's time interval."
                )
              : userQuery
                ? t(
                    "You can try adjusting your query by removing filters or increasing the chart's time interval."
                  )
                : t(
                    "You can try adjusting your query by increasing the chart's time interval."
                  )}
          {/* Do not show if no sampling happened to the data points in the series as they are already at 100% sampling  */}
          {!noSampling && (
            <Fragment>
              <br />
              <br />
              {t(
                'You can also increase your sampling rates to get more samples and accurate trends.'
              )}
            </Fragment>
          )}
        </div>
      }
      maxWidth={300}
      showUnderline
    >
      {children}
    </Tooltip>
  );
}

const Container = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;
