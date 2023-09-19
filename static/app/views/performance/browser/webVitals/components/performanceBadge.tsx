import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

type Props = {
  status: 'good' | 'meh' | 'poor';
};

export const scoreToStatus = (score: number) => {
  if (score >= 90) {
    return 'good';
  }
  if (score >= 50) {
    return 'meh';
  }
  return 'poor';
};

export function PerformanceBadge({status}: Props) {
  const theme = useTheme();
  const text = status === 'good' ? 'GOOD' : status === 'meh' ? 'MEH' : 'POOR';
  const color =
    status === 'good'
      ? theme.green300
      : status === 'meh'
      ? theme.yellow300
      : theme.red300;
  return <Badge color={color}>{text}</Badge>;
}

const Badge = styled('div')<{color: string}>`
  border-radius: 2px;
  color: ${p => p.theme.white};
  background-color: ${p => p.color};
  font-size: ${p => p.theme.fontSizeExtraSmall};
  font-weight: bold;
  padding: 0 4px;
  display: inline-block;
  height: 16px;
`;
