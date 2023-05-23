import styled from '@emotion/styled';

export const PlaintextLabel = styled('div')`
  text-align: right;
`;

export const ComparisonLabel = styled('div')<{value: number}>`
  text-align: right;
  color: ${p => (p.value < 0 ? p.theme.green400 : p.theme.red400)};
`;
