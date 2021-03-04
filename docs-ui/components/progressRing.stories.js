import React from 'react';
import {css} from '@emotion/core';
import styled from '@emotion/styled';

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
  title: 'DataVisualization/Charts/ProgressRing',
  args: {
    value: 29,
    size: 40,
    minValue: 0,
    maxValue: 100,
    barWidth: 3,
    text: '',
    animateText: false,
  },
  argTypes: {
    backgroundColor: {control: 'color'},
    progressColor: {control: 'color'},
  },
};

export const Default = ({...args}) => {
  return (
    <Grid>
      <ProgressRing {...args} />
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
};

Default.storyName = 'default';

const Grid = styled('div')`
  margin-top: 8px;
  display: grid;
  grid-template-columns: repeat(auto-fit, 50px);
  align-items: center;
  justify-content: center;
  grid-gap: 8px;
`;
