import {Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {useRef} from 'react';

export const FREQUENCY_BOX_WIDTH = 40;

type Props = {
  frequency: number;
};

// Colors are copied from tagsHeatMap.tsx, as they are not available on the theme
const purples = ['#D1BAFC', '#9282F3', '#6056BA', '#313087', '#021156'];

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
      background: ${purples[0]};
      color: ${theme.black};
    `;
  }

  if (frequency > 50) {
    return `
      background: ${purples[1]};
      color: ${theme.black};
    `;
  }

  if (frequency > 30) {
    return `
      background: ${purples[2]};
      color: ${theme.white};
    `;
  }

  return `
      background: ${purples[3]};
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
