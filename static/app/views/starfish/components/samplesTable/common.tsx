import styled from '@emotion/styled';

import {t} from 'sentry/locale';

type Props = {
  duration: number;
  p95: number;
};

export function DurationComparisonCell({duration, p95}: Props) {
  const diff = duration - p95;

  if (Math.floor(duration) === Math.floor(p95)) {
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
