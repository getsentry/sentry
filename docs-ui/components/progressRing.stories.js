import React from 'react';
import {withInfo} from '@storybook/addon-info';
import {number, text, boolean, color} from '@storybook/addon-knobs';
import styled from '@emotion/styled';
import {css} from '@emotion/core';

import ProgressRing from 'app/components/progressRing';

class Ticker extends React.Component {
  state = {
    tickNumber: 0,
  };

  componentDidMount() {
    this.interval = setInterval(this.tick, 1000);
  }

  componentWillUnmount() {
    clearInterval(this.interval);
  }

  tick = () =>
    this.setState(s => ({
      tickNumber: (s.tickNumber + 5) % 100,
    }));

  render() {
    return this.props.children({tickNumber: this.state.tickNumber});
  }
}

export default {
  title: 'UI/ProgressRing',
};

export const Default = withInfo('Circle style progress bar ')(() => {
  const value = number('Value', 29);
  const size = number('Size', 40);
  const minValue = number('Min Value', 0);
  const maxValue = number('Max Value', 100);
  const barWidth = number('Bar Width', 3);
  const textValue = text('Text Value', '');
  const animateText = boolean('Animate Text', false);
  const backgroundColor = color('Background color');
  const progressColor = color('Progress color');

  return (
    <Grid>
      <ProgressRing
        value={value}
        minValue={minValue}
        maxValue={maxValue}
        size={size}
        barWidth={barWidth}
        text={textValue}
        animateText={animateText}
        backgroundColor={backgroundColor}
        progressColor={progressColor}
      />
      <Ticker>
        {({tickNumber}) => (
          <ProgressRing
            animateText
            value={tickNumber}
            text={tickNumber}
            size={38}
            barWidth={4}
            progressColor="#f58159"
          />
        )}
      </Ticker>
      <ProgressRing
        value={65}
        size={60}
        barWidth={6}
        text="BAD"
        textCss={() => css`
          font-size: 14px;
          font-weight: bold;
          color: #ec5f5f;
        `}
        progressColor="#ff4d44"
        backgroundColor="#fbe6e6"
      />
    </Grid>
  );
});

Default.story = {
  name: 'default',
};

const Grid = styled('div')`
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fit, 50px);
  align-items: center;
  justify-content: center;
  grid-gap: 8px;
`;
