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

export function ConfidenceFooter({sampleCount, confidence, topEvents}: Props) {
  const prefix =
    defined(topEvents) && topEvents > 0
      ? t('Chart for top %s groups', topEvents)
      : t('Chart');
  return (
    <Container>
      {!defined(sampleCount)
        ? tct('* [prefix] extrapolated from \u2026', {prefix})
        : confidence === 'low'
          ? tct(
              '* [prefix]  extrapolated from [sampleCount] samples ([insufficientSamples])',
              {
                prefix,
                sampleCount: <Count value={sampleCount} />,
                insufficientSamples: (
                  <Tooltip
                    title={t(
                      'Increase your sampling rates to get more samples and more accurate trends.'
                    )}
                  >
                    <InsufficientSamples>
                      {t('Sampling rate may be low for accuracy')}
                    </InsufficientSamples>
                  </Tooltip>
                ),
              }
            )
          : tct('* [prefix] extrapolated from [sampleCount] samples', {
              prefix,
              sampleCount: <Count value={sampleCount} />,
            })}
    </Container>
  );
}

const InsufficientSamples = styled('span')`
  text-decoration: underline dotted ${p => p.theme.gray300};
`;

const Container = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeSmall};
`;
