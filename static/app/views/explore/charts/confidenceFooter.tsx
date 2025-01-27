import styled from '@emotion/styled';

import Count from 'sentry/components/count';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import type {Confidence} from 'sentry/types/organization';
import {defined} from 'sentry/utils';

type Props = {
  confidence?: Confidence;
  sampleCount?: number;
};

export function ConfidenceFooter({sampleCount, confidence}: Props) {
  return (
    <Container>
      {!defined(sampleCount)
        ? t('* Chart extrapolated from \u2026')
        : confidence === 'low'
          ? tct(
              '* Chart extrapolated from [sampleCount] samples ([insufficientSamples])',
              {
                sampleCount: <Count value={sampleCount} />,
                insufficientSamples: (
                  <Tooltip
                    title={t(
                      'Shortening the date range, increasing the time interval or removing extra filters may improve accuracy.'
                    )}
                  >
                    <InsufficientSamples>
                      {t('insufficient for accuracy')}
                    </InsufficientSamples>
                  </Tooltip>
                ),
              }
            )
          : tct('* Chart extrapolated from [sampleCount] samples', {
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
