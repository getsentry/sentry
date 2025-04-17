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

function confidenceMessage({
  sampleCount,
  confidence,
  topEvents,
  isSampled,
  dataScanned,
}: Props) {
  const isTopN = defined(topEvents) && topEvents > 1;
  if (!defined(sampleCount)) {
    return isTopN
      ? t('* Chart for top %s groups extrapolated from \u2026', topEvents)
      : t('* Chart extrapolated from \u2026');
  }

  const noSampling = defined(isSampled) && !isSampled;

  const partialScanTooltip = <_PartialScanTooltip />;
  const lowAccuracyFullSampleCount = <_LowAccuracyFullTooltip noSampling={noSampling} />;
  const sampleCountComponent = <Count value={sampleCount} />;
  if (confidence === 'low') {
    if (isTopN) {
      if (dataScanned === 'partial') {
        return tct(
          'Top [topEvents] groups based on [tooltip:[sampleCountComponent] samples (Max. Limit)]',
          {
            topEvents,
            tooltip: partialScanTooltip,
            sampleCountComponent,
          }
        );
      }

      return tct(
        'Top [topEvents] groups based on [tooltip:[sampleCountComponent] samples]',
        {
          topEvents,
          tooltip: lowAccuracyFullSampleCount,
          sampleCountComponent,
        }
      );
    }

    if (dataScanned === 'partial') {
      return tct('Based on [tooltip:[sampleCountComponent] samples (Max. Limit)]', {
        tooltip: partialScanTooltip,
        sampleCountComponent,
      });
    }

    return tct('Based on [tooltip:[sampleCountComponent] samples]', {
      tooltip: lowAccuracyFullSampleCount,
      sampleCountComponent,
    });
  }

  if (isTopN) {
    if (dataScanned === 'partial') {
      return tct(
        'Top [topEvents] groups based on [tooltip:[sampleCountComponent] samples (Max. Limit)]',
        {
          topEvents,
          tooltip: partialScanTooltip,
          sampleCountComponent,
        }
      );
    }

    return tct('Top [topEvents] groups based on [sampleCountComponent] samples', {
      topEvents,
      sampleCountComponent,
    });
  }

  if (dataScanned === 'partial') {
    return tct('Based on [tooltip:[sampleCountComponent] samples (Max. Limit)]', {
      tooltip: partialScanTooltip,
      sampleCountComponent,
    });
  }

  return tct('Based on [sampleCountComponent] samples', {
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
          {t('You may not have enough samples for high accuracy.')}
          <br />
          <br />
          {t(
            'You can try adjusting your query by removing filters or increasing the time interval.'
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

function _PartialScanTooltip({children}: {children?: React.ReactNode}) {
  return (
    <Tooltip
      title={
        <div>
          {t('We could not scan all available data due to time or resource limits.')}
          <br />
          <br />
          {t(
            'Try reducing your time range or removing filters to get more accurate trends.'
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
  font-size: ${p => p.theme.fontSizeSmall};
`;
