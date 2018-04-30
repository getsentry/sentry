import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';

import BarChart from 'app/components/barChart';

export default class Chart extends React.Component {
  static propTypes = {
    stats: PropTypes.array,
  };

  static defaultProps = {
    stats: [],
  };

  render() {
    const data = this.props.stats.map(d => ({x: d[0], y: d[1]}));

    return (
      <div>
        <StyledBarChart points={data} label="events" height={80} />
      </div>
    );
  }
}

const StyledBarChart = styled(BarChart)`
  a {
    background-color: rgba(175, 163, 187, 0.2);
    &:not(:first-child) {
      border-left: 2px solid white;
    }
    &:not(:last-child) {
      border-right: 2px solid white;
    }
    > span {
      left: 0;
      right: 0;
    }
  }
`;
