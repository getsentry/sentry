import styled from '@emotion/styled';

type Props = {
  current: number;
  prev: number;
};

function PercentChange({current, prev}: Props) {
  if (!current || !prev) {
    return null;
  }

  const pct = current / prev - 1;

  if (Math.round(pct * 100) === 0) {
    return null;
  }

  const formattedNumber = new Intl.NumberFormat('en-US', {
    style: 'percent',
    signDisplay: 'exceptZero',
  }).format(pct);

  return <Indicator value={pct}>{formattedNumber}</Indicator>;
}

const Indicator = styled('span')<{value: number}>`
  color: ${p => (p.value < 0 ? p.theme.colors.red400 : p.theme.green300)};
`;

export default PercentChange;
