import {ReactNode} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {Color} from 'sentry/utils/theme';

type ColorStop = {
  color: Color | string;
  percent: number;
  renderBarStatus?: (barStatus: ReactNode, key: string) => ReactNode;
};

type Props = {
  colorStops: ColorStop[];
  barHeight?: number;
};

const ColorBar = (props: Props) => {
  return (
    <VitalBar
      barHeight={props.barHeight}
      fractions={props.colorStops.map(({percent}) => percent)}
    >
      {props.colorStops.map(colorStop => {
        const barStatus = <BarStatus color={colorStop.color} key={colorStop.color} />;

        return colorStop.renderBarStatus?.(barStatus, colorStop.color) ?? barStatus;
      })}
    </VitalBar>
  );
};

type VitalBarProps = {
  fractions: number[];
  barHeight?: number;
};

const VitalBar = styled('div')<VitalBarProps>`
  height: ${p => (p.barHeight ? `${p.barHeight}px` : '16px')};
  width: 100%;
  overflow: hidden;
  position: relative;
  background: ${p => p.theme.gray100};
  display: grid;
  grid-template-columns: ${p => p.fractions.map(f => `${f}fr`).join(' ')};
  margin-bottom: ${p => (p.barHeight ? '' : space(1))};
  border-radius: 2px;
`;

type ColorProps = {
  color: Color | string;
};

const BarStatus = styled('div')<ColorProps>`
  background-color: ${p => p.theme[p.color] ?? p.color};
`;

export default ColorBar;
