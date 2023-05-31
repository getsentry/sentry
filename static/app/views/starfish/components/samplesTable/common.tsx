import styled from '@emotion/styled';

import {t} from 'sentry/locale';

type Props = {
  duration: number;
  p50: number;
};

export function DurationComparisonCell({duration, p50}: Props) {
  const diff = duration - p50;

  if (Math.floor(duration) === Math.floor(p50)) {
    return <PlaintextLabel>{t('At baseline')}</PlaintextLabel>;
  }

  const labelString =
    diff > 0 ? `+${diff.toFixed(2)}ms above` : `${diff.toFixed(2)}ms below`;

  return <ComparisonLabel value={diff}>{labelString}</ComparisonLabel>;
}

export const PlaintextLabel = styled('div')`
  text-align: right;
`;

export const ComparisonLabel = styled('div')<{value: number}>`
  text-align: right;
  color: ${p => (p.value < 0 ? p.theme.green400 : p.theme.red400)};
`;
