import PropTypes from 'prop-types';
import React from 'react';

import StackedBarChart from 'app/components/stackedBarChart';

type Props = Partial<Omit<React.ComponentProps<typeof StackedBarChart>, 'points'>> & {
  points: Array<{x: number; y: number; label?: string}>;
};

const BarChart = (props: Props) => {
  const points = props.points.map(point => ({x: point.x, y: [point.y]}));
  const propsClone = Object.assign({}, props, {points});
  return <StackedBarChart {...propsClone} />;
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

BarChart.defaultProps = {
  points: [],
};

export default BarChart;
