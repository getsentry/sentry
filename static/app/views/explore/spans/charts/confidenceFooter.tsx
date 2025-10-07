import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {t, tct} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import usePrevious from 'sentry/utils/usePrevious';

type Props = {
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  extrapolate?: boolean;
  isLoading?: boolean;
  isSampled?: boolean | null;
  sampleCount?: number;
  topEvents?: number;
};

export function ConfidenceFooter(props: Props) {
  const previousProps = usePrevious(props, props.isLoading);
  return (
    <Container>{confidenceMessage(props.isLoading ? previousProps : props)}</Container>
  );
}

function confidenceMessage({
  extrapolate,
  sampleCount,
  confidence,
  topEvents,
  isSampled,
}: Props) {
  const isTopN = defined(topEvents) && topEvents > 1;

  if (defined(extrapolate) && !extrapolate) {
    if (!defined(sampleCount)) {
      return t('Span Count: \u2026');
    }
    return tct('Span Count: [sampleCountComponent]', {
      sampleCountComponent: <Count value={sampleCount} />,
    });
  }

  if (!defined(sampleCount)) {
    return isTopN
      ? t('* Top %s groups extrapolated from \u2026', topEvents)
      : t('* Extrapolated from \u2026');
  }

  const noSampling = defined(isSampled) && !isSampled;

  const lowAccuracyFullSampleCount = <_LowAccuracyFullTooltip noSampling={noSampling} />;
  const sampleCountComponent = <Count value={sampleCount} />;
  if (confidence === 'low') {
    if (isTopN) {
      return tct(
        'Top [topEvents] groups extrapolated from [tooltip:[sampleCountComponent] span samples]',
        {
          topEvents,
          tooltip: lowAccuracyFullSampleCount,
          sampleCountComponent,
        }
      );
    }

    return tct('Extrapolated from [tooltip:[sampleCountComponent] span samples]', {
      tooltip: lowAccuracyFullSampleCount,
      sampleCountComponent,
    });
  }

  if (isTopN) {
    return tct(
      'Top [topEvents] groups extrapolated from [sampleCountComponent] span samples',
      {
        topEvents,
        sampleCountComponent,
      }
    );
  }

  return tct('Extrapolated from [sampleCountComponent] span samples', {
    sampleCountComponent,
  });
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

const Container = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;
