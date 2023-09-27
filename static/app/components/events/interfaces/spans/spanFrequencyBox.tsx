import {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {useRef} from 'react';

export const FREQUENCY_BOX_WIDTH = 40;

type Props = {
  frequency: number;
};

export function SpanFrequencyBox({frequency}: Props) {
  const frequencyRef = useRef<number>(Math.round(Math.random() * 100));
  return <StyledBox frequency={frequencyRef.current}>{frequencyRef.current}%</StyledBox>;
}

function getBoxColors(frequency: number, theme: Theme) {
  if (frequency > 90) {
    return `
      background: ${theme.white};
      color: ${theme.black};
    `;
  }

  if (frequency > 70) {
    return `
      background: ${theme.purple100};
      color: ${theme.black};
    `;
  }

  if (frequency > 50) {
    return `
      background: ${theme.purple200};
      color: ${theme.black};
    `;
  }

  if (frequency > 30) {
    return `
      background: ${theme.purple300};
      color: ${theme.white};
    `;
  }

  return `
      background: ${theme.purple400};
      color: ${theme.white};
    `;
}

const StyledBox = styled('div')<{frequency: number}>`
  display: flex;
  justify-content: center;
  align-items: center;
  background: ${p => p.theme.purple200};
  height: 100%;
  width: ${FREQUENCY_BOX_WIDTH}px;
  border-left: 1px solid ${p => p.theme.gray200};
  border-right: 1px solid ${p => p.theme.gray200};

  font-size: ${p => p.theme.fontSizeExtraSmall};

  ${p => getBoxColors(p.frequency, p.theme)}
`;
