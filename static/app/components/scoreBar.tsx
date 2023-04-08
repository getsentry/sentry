import styled from '@emotion/styled';

import theme from 'sentry/utils/theme';

type Props = {
  score: number;
  className?: string;
  palette?: Readonly<string[]>;
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
  palette = theme.similarity.colors,
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
  ${p => p.empty && `background-color: ${p.theme.similarity.empty};`};
  ${p => p.color && `background-color: ${p.color};`};

  width: ${p => (!p.vertical ? p.thickness : p.size)}px;
  height: ${p => (!p.vertical ? p.size : p.thickness)}px;
`;

export default ScoreBar;
