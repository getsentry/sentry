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

interface ConfidenceFooterProps {
  chartInfo: ChartInfo;
  isLoading: boolean;
}

export function ConfidenceFooter({
  chartInfo: currentChartInfo,
  isLoading,
}: ConfidenceFooterProps) {
  const chartInfo = usePreviouslyLoaded(currentChartInfo, isLoading);
  return (
    <Container>
      <ConfidenceMessage
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
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  isSampled?: boolean | null;
  sampleCount?: number;
  topEvents?: number;
}

export function ConfidenceMessage({
  sampleCount,
  dataScanned,
  confidence,
  topEvents,
  isSampled,
}: ConfidenceMessageProps) {
  const isTopN = defined(topEvents) && topEvents > 1;

  if (!defined(sampleCount)) {
    return isTopN
      ? t('* Top %s groups extrapolated based on \u2026', topEvents)
      : t('* Extrapolated based on \u2026');
  }

  const noSampling = defined(isSampled) && !isSampled;
  const sampleCountComponent = <Count value={sampleCount} />;

  if (dataScanned === 'full') {
    // For logs, if the full data was scanned, we can assume that no
    // extrapolation happened and we should remove mentions of extrapolation.
    if (isTopN) {
      return tct('Top [topEvents] groups based on [sampleCountComponent] logs', {
        topEvents,
        sampleCountComponent,
      });
    }

    return tct('Based on [sampleCountComponent] logs', {
      sampleCountComponent,
    });
  }

  if (confidence === 'low') {
    const lowAccuracyFullSampleCount = <LowAccuracyFullTooltip noSampling={noSampling} />;

    if (isTopN) {
      return tct(
        'Top [topEvents] groups extrapolated based on [tooltip:[sampleCountComponent] logs]',
        {
          topEvents,
          tooltip: lowAccuracyFullSampleCount,
          sampleCountComponent,
        }
      );
    }

    return tct('Extrapolated based on [tooltip:[sampleCountComponent] logs]', {
      tooltip: lowAccuracyFullSampleCount,
      sampleCountComponent,
    });
  }

  if (isTopN) {
    return tct(
      'Top [topEvents] groups extrapolated based on [sampleCountComponent] logs',
      {
        topEvents,
        sampleCountComponent,
      }
    );
  }

  return tct('Extrapolated based on [sampleCountComponent] logs', {
    sampleCountComponent,
  });
}

function LowAccuracyFullTooltip({
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
            'You may not have enough logs for a high accuracy extrapolation of your query.'
          )}
          <br />
          <br />
          {t(
            "You can try adjusting your query by narrowing the date range, removing filters or increasing the chart's time interval."
          )}
          <br />
          <br />
          {t(
            'You can also increase your sampling rates to get more samples and accurate trends.'
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
