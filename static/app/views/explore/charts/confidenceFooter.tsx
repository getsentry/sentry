import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import Count from 'sentry/components/count';
import {t, tct} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';

type Props = {
  confidence?: Confidence;
  dataScanned?: 'full' | 'partial';
  isSampled?: boolean | null;
  sampleCount?: number;
  topEvents?: number;
};

export function ConfidenceFooter(props: Props) {
  return <Container>{confidenceMessage(props)}</Container>;
}

function confidenceMessage({sampleCount, confidence, topEvents, isSampled}: Props) {
  const isTopN = defined(topEvents) && topEvents > 1;
  if (!defined(sampleCount)) {
    return isTopN
      ? t('* Top %s groups extrapolated based on \u2026', topEvents)
      : t('* Extrapolated based on \u2026');
  }

  const noSampling = defined(isSampled) && !isSampled;

  const lowAccuracyFullSampleCount = <_LowAccuracyFullTooltip noSampling={noSampling} />;
  const sampleCountComponent = <Count value={sampleCount} />;
  if (confidence === 'low') {
    if (isTopN) {
      return tct(
        'Top [topEvents] groups extrapolated based on [tooltip:[sampleCountComponent] span samples]',
        {
          topEvents,
          tooltip: lowAccuracyFullSampleCount,
          sampleCountComponent,
        }
      );
    }

    return tct('Extrapolated based on [tooltip:[sampleCountComponent] span samples]', {
      tooltip: lowAccuracyFullSampleCount,
      sampleCountComponent,
    });
  }

  if (isTopN) {
    return tct(
      'Top [topEvents] groups extrapolated based on [sampleCountComponent] span samples',
      {
        topEvents,
        sampleCountComponent,
      }
    );
  }

  return tct('Extrapolated based on [sampleCountComponent] span samples', {
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
