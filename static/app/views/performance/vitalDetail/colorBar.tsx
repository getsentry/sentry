import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import {Color} from 'sentry/utils/theme';

type ColorStop = {
  percent: number;
  color: Color;
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
        return <BarStatus color={colorStop.color} key={colorStop.color} />;
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
  color: Color;
};

const BarStatus = styled('div')<ColorProps>`
  background-color: ${p => p.theme[p.color]};
`;

export default ColorBar;
