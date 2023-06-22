import styled from '@emotion/styled';

export const PercentChangeCell = styled('div')<{
  trendDirection: 'good' | 'bad' | 'neutral';
}>`
  color: ${p =>
    p.trendDirection === 'good'
      ? p.theme.successText
      : p.trendDirection === 'bad'
      ? p.theme.errorText
      : p.theme.subText};
  float: right;
`;
