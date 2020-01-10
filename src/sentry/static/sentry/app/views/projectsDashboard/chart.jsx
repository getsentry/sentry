import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

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
        <StyledBarChart points={data} label="events" height={60} gap={1.5} />
      </div>
    );
  }
}

const StyledBarChart = styled(BarChart)`
  a {
    &:not(:first-child) {
      border-left: 2px solid transparent;
    }
    &:not(:last-child) {
      border-right: 2px solid transparent;
    }
    > span {
      left: 0;
      right: 0;
    }
  }
`;
