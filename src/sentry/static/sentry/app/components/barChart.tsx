import PropTypes from 'prop-types';
import React from 'react';

import StackedBarChart from 'app/components/stackedBarChart';

type Props = Partial<Omit<React.ComponentProps<typeof StackedBarChart>, 'points'>> & {
  points?: Array<{x: number; y: number; label?: string}>;
};

const BarChart = ({points = [], ...rest}: Props) => {
  const formattedPoints = points.map(point => ({x: point.x, y: [point.y]}));
  const props = {...rest, points: formattedPoints};
  return <StackedBarChart {...props} />;
};

BarChart.propTypes = {
  points: PropTypes.arrayOf(
    PropTypes.shape({
      x: PropTypes.number.isRequired,
      y: PropTypes.number.isRequired,
      label: PropTypes.string,
    })
  ),
  interval: PropTypes.string,
  height: PropTypes.number,
  width: PropTypes.number,
  label: PropTypes.string,
  markers: PropTypes.arrayOf(
    PropTypes.shape({
      x: PropTypes.number.isRequired,
      label: PropTypes.string,
    })
  ),
};

export default BarChart;
