import styled from '@emotion/styled';

import space from 'app/styles/space';
import {Color} from 'app/utils/theme';

type ColorStop = {
  percent: number;
  color: Color;
};

type Props = {
  colorStops: ColorStop[];
};

const ColorBar = (props: Props) => {
  return (
    <VitalBar fractions={props.colorStops.map(({percent}) => percent)}>
      {props.colorStops.map(colorStop => {
        return <BarStatus color={colorStop.color} key={colorStop.color} />;
      })}
    </VitalBar>
  );
};

type VitalBarProps = {
  fractions: number[];
};

const VitalBar = styled('div')<VitalBarProps>`
  height: 16px;
  width: 100%;
  overflow: hidden;
  position: relative;
  background: ${p => p.theme.gray100};
  display: grid;
  grid-template-columns: ${p => p.fractions.map(f => `${f}fr`).join(' ')};
  margin-bottom: ${space(1)};
  border-radius: 2px;
`;

type ColorProps = {
  color: Color;
};

const BarStatus = styled('div')<ColorProps>`
  background-color: ${p => p.theme[p.color]};
`;

export default ColorBar;
