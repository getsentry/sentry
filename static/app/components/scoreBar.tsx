import styled from '@emotion/styled';

import {SIMILARITY_SCORE_COLORS} from './similarScoreCard';

type Props = {
  score: number;
  className?: string;
  palette?: readonly string[];
  paletteClassNames?: string[];
  radius?: number;
  size?: number;
  thickness?: number;
  vertical?: boolean;
};

function BaseScoreBar({
  score,
  className,
  vertical,
  size = 40,
  thickness = 4,
  radius = 3,
  palette = SIMILARITY_SCORE_COLORS,
  ...props
}: Props) {
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
    <div className={className} {...props}>
      {[...Array(scoreInBounds)].map((_j, i) => (
        <Bar {...barProps} key={i} color={palette[paletteIndex]} />
      ))}
      {[...Array(maxScore - scoreInBounds)].map((_j, i) => (
        <Bar key={`empty-${i}`} {...barProps} empty />
      ))}
    </div>
  );
}

const ScoreBar = styled(BaseScoreBar)`
  display: flex;

  ${p =>
    p.vertical
      ? `flex-direction: column-reverse;
    justify-content: flex-end;`
      : 'min-width: 80px;'};
`;

type BarProps = {
  radius: number;
  size: number;
  thickness: number;
  color?: string;
  empty?: boolean;
  vertical?: boolean;
};

const Bar = styled('div')<BarProps>`
  border-radius: ${p => p.radius}px;
  margin: 2px;
  /* @TODO(jonasbadalic) This used to be defined on the theme, but is component specific and had no dark mode color. */
  ${p => p.empty && `background-color: #e2dee6;`}
  ${p => p.color && `background-color: ${p.color};`}

  width: ${p => (!p.vertical ? p.thickness : p.size)}px;
  height: ${p => (!p.vertical ? p.size : p.thickness)}px;
`;

export default ScoreBar;
