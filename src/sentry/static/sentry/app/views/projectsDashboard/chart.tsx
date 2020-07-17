import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';

import {Project} from 'app/types';
import BarChart from 'app/components/barChart';

type Props = {
  stats: Required<Project>['stats'];
};

const Chart = ({stats}: Props) => {
  const data = stats.map(d => ({x: d[0], y: d[1]}));

  return (
    <div>
      <StyledBarChart points={data} label="events" height={60} gap={1.5} />
    </div>
  );
};

Chart.propTypes = {
  stats: PropTypes.array,
};

Chart.defaultProps = {
  stats: [],
};

export default Chart;

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
