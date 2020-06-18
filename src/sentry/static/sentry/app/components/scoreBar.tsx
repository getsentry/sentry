import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import theme from 'app/utils/theme';

type DefaultProps = {
  size: number;
  thickness: number;
  radius: number;
  palette: Readonly<string[]>;
};

type Props = DefaultProps & {
  vertical?: boolean;
  score: number;
  paletteClassNames?: string[];
  className?: string;
};

class ScoreBar extends React.Component<Props> {
  static propTypes = {
    vertical: PropTypes.bool,
    score: PropTypes.number.isRequired,
    /** Array of strings */
    palette: PropTypes.arrayOf(PropTypes.string),
    /** Array of classNames whose index maps to score */
    paletteClassNames: PropTypes.arrayOf(PropTypes.string),
    size: PropTypes.number,
    thickness: PropTypes.number,
    radius: PropTypes.number,
  };

  static defaultProps: DefaultProps = {
    size: 40,
    thickness: 4,
    radius: 3,
    palette: theme.similarity.colors,
  };

  render() {
    const {className, vertical, palette, score, size, thickness, radius} = this.props;
    const maxScore = palette.length;

    // Make sure score is between 0 and maxScore
    const scoreInBounds = score >= maxScore ? maxScore : score <= 0 ? 0 : score;
    // Make sure paletteIndex is 0 based
    const paletteIndex = scoreInBounds - 1;

    // Size of bar, depends on orientation, although we could just apply a transformation via css
    const barProps = {
      vertical,
      thickness,
      size,
      radius,
    };

    return (
      <div className={className}>
        {[...Array(scoreInBounds)].map((_j, i) => (
          <Bar {...barProps} key={i} color={palette[paletteIndex]} />
        ))}
        {[...Array(maxScore - scoreInBounds)].map((_j, i) => (
          <Bar key={`empty-${i}`} {...barProps} empty />
        ))}
      </div>
    );
  }
}

const StyledScoreBar = styled(ScoreBar)`
  display: flex;

  ${p =>
    p.vertical
      ? `flex-direction: column-reverse;
    justify-content: flex-end;`
      : 'min-width: 80px;'};
`;

type BarProps = {
  empty?: boolean;
  color?: string;
  vertical?: boolean;
  thickness: number;
  size: number;
  radius: number;
};

const Bar = styled('div')<BarProps>`
  border-radius: ${p => p.radius}px;
  margin: 2px;
  ${p => p.empty && `background-color: ${p.theme.similarity.empty};`};
  ${p => p.color && `background-color: ${p.color};`};

  width: ${p => (!p.vertical ? p.thickness : p.size)}px;
  height: ${p => (!p.vertical ? p.size : p.thickness)}px;
`;

export default StyledScoreBar;
