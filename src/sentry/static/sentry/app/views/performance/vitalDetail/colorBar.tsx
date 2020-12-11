import React from 'react';
import styled from '@emotion/styled';

type ColorStop = {
  percent: number;
  color: string;
};

type Props = {
  colorStops: ColorStop[];
};

const ColorBar = (props: Props) => {
  return (
    <Container fractions={props.colorStops.map(({percent}) => percent)}>
      {props.colorStops.map(colorStop => {
        return <Bar color={colorStop.color} key={colorStop.color} />;
      })}
    </Container>
  );
};

type ContainerProps = {
  fractions: number[];
};

const Container = styled('div')<ContainerProps>`
  height: 16px;
  width: 100%;
  overflow: hidden;
  position: relative;
  background: ${p => p.theme.gray100};
  display: grid;
  grid-template-columns: ${p => p.fractions.map(f => `${f}fr`).join(' ')};
`;

type BarProps = {
  color: string;
};

const Bar = styled('div')<BarProps>`
  background-color: ${p => p.color};
`;

export default ColorBar;
