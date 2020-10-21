import PropTypes from 'prop-types';
import * as React from 'react';

import StackedBarChart from 'app/components/stackedBarChart';
import theme from 'app/utils/theme';

type Props = Partial<
  Omit<React.ComponentProps<typeof StackedBarChart>, 'points' | 'secondaryPoints'>
> & {
  points?: Array<{x: number; y: number; label?: string}>;
  secondaryPoints?: Array<{x: number; y: number; label?: string}>;
};

const BarChart = ({points = [], secondaryPoints = [], ...rest}: Props) => {
  const formattedPoints = points.map(point => ({
    x: point.x,
    y: [point.y],
    color: secondaryPoints.length ? theme.purple400 : undefined,
  }));
  const formattedSecondaryPoints = secondaryPoints.map(point => ({
    x: point.x,
    y: [point.y],
    color: secondaryPoints.length ? theme.gray400 : undefined,
  }));
  const props = {
    ...rest,
    points: formattedPoints,
    secondaryPoints: formattedSecondaryPoints,
  };
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
  secondaryPoints: PropTypes.arrayOf(
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
  showSecondaryPoints: PropTypes.bool,
};

export default BarChart;
