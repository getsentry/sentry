import * as React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

type PathProps = {
  dashRatio: number;
  pathRadius: number;
  strokeWidth: number;
  size: number;
  className?: string;
};

const Path = ({dashRatio, pathRadius, strokeWidth, size, className}: PathProps) => {
  const diameter = Math.PI * 2 * pathRadius;
  const gapLength = (1 - dashRatio) * diameter;

  return (
    <path
      className={className}
      style={{
        strokeDasharray: `${diameter}px ${diameter}px`,
        strokeDashoffset: `${gapLength}px`,
      }}
      d={`
      M ${size / 2},${size / 2}
      m 0,-${pathRadius}
      a ${pathRadius},${pathRadius} 0 1 1 0,${2 * pathRadius}
      a ${pathRadius},${pathRadius} 0 1 1 0,-${2 * pathRadius}
    `}
      strokeWidth={strokeWidth}
      fillOpacity={0}
    />
  );
};

type Props = {
  value: number;
  size?: number;
  maxValue?: number;
  minValue?: number;
  strokeWidth?: number;
};

const CircularProgressbar = ({
  value,
  size = 20,
  maxValue = 100,
  minValue = 0,
  strokeWidth = 3,
}: Props) => {
  const pathRadius = size / 2 - strokeWidth / 2;
  const boundedValue = Math.min(Math.max(value, minValue), maxValue);
  const pathRatio = (boundedValue - minValue) / (maxValue - minValue);

  return (
    <ProgressbarWrapper>
      <Progressbar viewBox={`0 0 ${size} ${size}`} size={size}>
        <Trail
          size={size}
          dashRatio={1}
          pathRadius={pathRadius}
          strokeWidth={strokeWidth}
        />

        <Progress
          value={value}
          size={size}
          dashRatio={pathRatio}
          pathRadius={pathRadius}
          strokeWidth={strokeWidth}
        />
      </Progressbar>
    </ProgressbarWrapper>
  );
};

// TODO(releasesv2): adjust thresholds once decided, probably pass as props
const getColor = ({value, theme}) => {
  if (value < 33) {
    return theme.red;
  }
  if (value < 66) {
    return theme.yellowOrange;
  }
  if (value >= 66) {
    return theme.green;
  }

  return theme.gray3;
};

const ProgressbarWrapper = styled('div')`
  display: inline-block;
  position: relative;
  bottom: ${space(0.25)};
`;

const Progressbar = styled('svg')<{size: number}>`
  width: ${p => p.size}px;
  vertical-align: middle;
`;

const Trail = styled(Path)`
  stroke: ${p => p.theme.offWhite2};
`;

const Progress = styled(Path)<{value: number}>`
  transition: stroke-dashoffset 0.5s ease 0s;
  stroke: ${getColor};
`;

export default CircularProgressbar;
