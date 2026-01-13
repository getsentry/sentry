import type {ReactNode} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

type ColorStop = {
  color: string;
  percent: number;
  renderBarStatus?: (barStatus: ReactNode, key: string) => ReactNode;
};

interface Props extends React.HTMLAttributes<HTMLDivElement> {
  colorStops: ColorStop[];
  barHeight?: number;
}

function ColorBar(props: Props) {
  return (
    <VitalBar
      barHeight={props.barHeight}
      fractions={props.colorStops.map(({percent}) => percent)}
      {...props}
    >
      {props.colorStops.map(colorStop => {
        const barStatus = <BarStatus color={colorStop.color} key={colorStop.color} />;

        return colorStop.renderBarStatus?.(barStatus, colorStop.color) ?? barStatus;
      })}
    </VitalBar>
  );
}

type VitalBarProps = {
  fractions: number[];
  barHeight?: number;
};

const VitalBar = styled('div')<VitalBarProps>`
  height: ${p => (p.barHeight ? `${p.barHeight}px` : '16px')};
  width: 100%;
  overflow: hidden;
  position: relative;
  background: ${p => p.theme.colors.gray100};
  display: grid;
  grid-template-columns: ${p => p.fractions.map(f => `${f}fr`).join(' ')};
  margin-bottom: ${p => (p.barHeight ? '' : space(1))};
  border-radius: 2px;
`;

const BarStatus = styled('div')<{color: string}>`
  background-color: ${p => p.color};
`;

export default ColorBar;
