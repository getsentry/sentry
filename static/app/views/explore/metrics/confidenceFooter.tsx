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

interface ConfidenceFooterProps {
  chartInfo: ChartInfo;
  hasUserQuery: boolean;
  isLoading: boolean;
}

export function ConfidenceFooter({
  chartInfo: currentChartInfo,
  hasUserQuery,
  isLoading,
}: ConfidenceFooterProps) {
  const chartInfo = usePreviouslyLoaded(currentChartInfo, isLoading);

  return (
    <Container>
      <ConfidenceMessage
        isLoading={isLoading}
        hasUserQuery={hasUserQuery}
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
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  isSampled?: boolean | null;
  sampleCount?: number;
  topEvents?: number;
}

function ConfidenceMessage({
  sampleCount,
  dataScanned,
  confidence,
  topEvents,
  hasUserQuery,
  isLoading,
  isSampled,
}: ConfidenceMessageProps) {
  const isTopN = defined(topEvents) && topEvents > 1;

  if (!defined(sampleCount) || isLoading) {
    return <Placeholder width={180} />;
  }

  const noSampling = defined(isSampled) && !isSampled;
  const sampleCountComponent = <Count value={sampleCount} />;

  if (dataScanned === 'full') {
    if (!hasUserQuery) {
      if (isTopN) {
        return tct('Metric count for top [topEvents] groups: [sampleCountComponent]', {
          topEvents,
          sampleCountComponent,
        });
      }

      return tct('Metric count: [sampleCountComponent]', {
        sampleCountComponent,
      });
    }

    // For metrics, if the full data was scanned, we can assume that no
    // extrapolation happened and we should remove mentions of extrapolation.
    if (isTopN) {
      return tct('[sampleCountComponent] matching metrics for top [topEvents] groups', {
        topEvents,
        sampleCountComponent,
      });
    }

    return tct('[sampleCountComponent] matching metrics', {
      sampleCountComponent,
    });
  }

  if (confidence === 'low') {
    const lowAccuracyFullSampleCount = <LowAccuracyFullTooltip noSampling={noSampling} />;

    if (isTopN) {
      return tct(
        'Top [topEvents] groups extrapolated from [tooltip:[sampleCountComponent] metrics]',
        {
          topEvents,
          tooltip: lowAccuracyFullSampleCount,
          sampleCountComponent,
        }
      );
    }

    return tct('Extrapolated from [tooltip:[sampleCountComponent] metrics]', {
      tooltip: lowAccuracyFullSampleCount,
      sampleCountComponent,
    });
  }

  if (isTopN) {
    return tct(
      'Top [topEvents] groups extrapolated from [sampleCountComponent] metrics',
      {
        topEvents,
        sampleCountComponent,
      }
    );
  }

  return tct('Extrapolated from [sampleCountComponent] metrics', {
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
          {t('Some metrics are not shown due to the large volume of metrics.')}
          <br />
          <br />
          {t('Try reducing the date range or number of projects.')}
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
  border-radius: ${p => p.theme.radius.md};
  background-color: ${p => p.theme.tokens.background.tertiary};
`;
