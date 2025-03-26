import styled from '@emotion/styled';

import Count from 'sentry/components/count';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';

type Props = {
  confidence?: Confidence;
  sampleCount?: number;
  topEvents?: number;
};

export function ConfidenceFooter(props: Props) {
  return <Container>{confidenceMessage(props)}</Container>;
}

function confidenceMessage({sampleCount, confidence, topEvents}: Props) {
  const isTopN = defined(topEvents) && topEvents > 0;
  if (!defined(sampleCount)) {
    return isTopN
      ? t('* Chart for top %s groups extrapolated from \u2026', topEvents)
      : t('* Chart extrapolated from \u2026');
  }

  const lowAccuracySampleCount = (
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
      maxWidth={270}
    >
      <InsufficientSamples>
        <Count value={sampleCount} />
      </InsufficientSamples>
    </Tooltip>
  );

  if (confidence === 'low') {
    if (isTopN) {
      return tct('Sample count for top [topEvents] groups: [sampleCount]', {
        topEvents,
        sampleCount: lowAccuracySampleCount,
      });
    }
    return tct('Sample count: [sampleCount]', {
      sampleCount: lowAccuracySampleCount,
    });
  }

  if (isTopN) {
    return tct('Sample count for top [topEvents] groups: [sampleCount]', {
      topEvents,
      sampleCount: <Count value={sampleCount} />,
    });
  }

  return tct('Sample count: [sampleCount]', {
    sampleCount: <Count value={sampleCount} />,
  });
}

const InsufficientSamples = styled('span')`
  text-decoration: underline dotted ${p => p.theme.gray300};
`;

const Container = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;
