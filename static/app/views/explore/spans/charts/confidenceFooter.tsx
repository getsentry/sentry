import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {t, tct} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import usePrevious from 'sentry/utils/usePrevious';
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
  const previousProps = usePrevious(props, props.isLoading);
  return (
    <Container>{confidenceMessage(props.isLoading ? previousProps : props)}</Container>
  );
}

function confidenceMessage({
  extrapolate,
  rawSpanCounts,
  sampleCount,
  confidence,
  topEvents,
  isSampled,
  isLoading,
  userQuery,
}: Props) {
  const isTopN = defined(topEvents) && topEvents > 1;

  if (!defined(sampleCount) || isLoading) {
    return <Placeholder width={180} />;
  }

  if (
    // Extrapolation disabled, so don't mention extrapolation.
    (defined(extrapolate) && !extrapolate) ||
    // High confidence without user query means we're in a default query.
    // We check for high confidence here because we still want to show the
    // tooltip here if it's low confidence
    (confidence === 'high' && !userQuery)
  ) {
    return isTopN
      ? tct('Span count for top [topEvents] groups: [matchingSpansCount]', {
          topEvents,
          matchingSpansCount: <Count value={sampleCount} />,
        })
      : tct('Span count: [matchingSpansCount]', {
          matchingSpansCount: <Count value={sampleCount} />,
        });
  }

  const noSampling = defined(isSampled) && !isSampled;
  const lowAccuracyFullSampleCount = <_LowAccuracyFullTooltip noSampling={noSampling} />;

  // The multi query mode does not fetch the raw span counts
  // so make sure to have a backup when this happens.
  if (!defined(rawSpanCounts)) {
    const matchingSpansCount =
      sampleCount > 1
        ? t('%s spans', <Count value={sampleCount} />)
        : t('%s span', <Count value={sampleCount} />);

    if (confidence === 'high') {
      if (isTopN) {
        return tct('Extrapolated from [matchingSpansCount] for top [topEvents] groups', {
          topEvents,
          matchingSpansCount,
        });
      }

      return tct('Extrapolated from [matchingSpansCount]', {
        matchingSpansCount,
      });
    }

    if (isTopN) {
      return tct(
        'Extrapolated from [tooltip:[matchingSpansCount]] for top [topEvents] groups',
        {
          topEvents,
          matchingSpansCount,
          tooltip: lowAccuracyFullSampleCount,
        }
      );
    }

    return tct('Extrapolated from [tooltip:[matchingSpansCount]]', {
      matchingSpansCount,
      tooltip: lowAccuracyFullSampleCount,
    });
  }

  const matchingSpansCount =
    sampleCount > 1
      ? t('%s matches', <Count value={sampleCount} />)
      : t('%s match', <Count value={sampleCount} />);

  const downSampledSpansCount = rawSpanCounts.normal.count ? (
    rawSpanCounts.normal.count > 1 ? (
      t('%s samples', <Count value={rawSpanCounts.normal.count} />)
    ) : (
      t('%s sample', <Count value={rawSpanCounts.normal.count} />)
    )
  ) : (
    <Placeholder width={40} />
  );
  const allSpansCount = rawSpanCounts.highAccuracy.count ? (
    rawSpanCounts.highAccuracy.count > 1 ? (
      t('%s spans', <Count value={rawSpanCounts.highAccuracy.count} />)
    ) : (
      t('%s span', <Count value={rawSpanCounts.highAccuracy.count} />)
    )
  ) : (
    <Placeholder width={40} />
  );

  if (confidence === 'high') {
    if (isTopN) {
      return tct(
        'Extrapolated from [matchingSpansCount] for top [topEvents] groups in [allSpansCount]',
        {
          topEvents,
          matchingSpansCount,
          allSpansCount,
        }
      );
    }

    return tct('Extrapolated from [matchingSpansCount] in [allSpansCount]', {
      matchingSpansCount,
      allSpansCount,
    });
  }

  if (isTopN) {
    return tct(
      '[warning] Extrapolated from [matchingSpansCount] for top [topEvents] groups after scanning [tooltip:[downSampledSpansCount] of [allSpansCount]]',
      {
        warning: <WarningIcon />,
        topEvents,
        matchingSpansCount,
        downSampledSpansCount,
        allSpansCount,
        tooltip: lowAccuracyFullSampleCount,
      }
    );
  }

  return tct(
    '[warning] Extrapolated from [matchingSpansCount] after scanning [tooltip:[downSampledSpansCount] of [allSpansCount]]',
    {
      warning: <WarningIcon />,
      matchingSpansCount,
      downSampledSpansCount,
      allSpansCount,
      tooltip: lowAccuracyFullSampleCount,
    }
  );
}

function _LowAccuracyFullTooltip({
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
            'You may not have enough span samples for a high accuracy extrapolation of your query.'
          )}
          <br />
          {t(
            "You can try adjusting your query by narrowing the date range, removing filters or increasing the chart's time interval."
          )}
          {/* Do not show if no sampling happened to the data points in the series as they are already at 100% sampling  */}
          {!noSampling && (
            <Fragment>
              <br />
              {t(
                'You can also increase your sampling rates to get more samples and accurate trends.'
              )}
            </Fragment>
          )}
        </div>
      }
      maxWidth={270}
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
