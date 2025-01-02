import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import theme from 'sentry/utils/theme';

interface ChevronProps extends React.SVGAttributes<SVGSVGElement> {
  direction?: 'up' | 'right' | 'down' | 'left';
  /**
   * Whether to lighten (by lowering the opacity) the chevron. Useful if the chevron is
   * inside a dropdown trigger button.
   */
  light?: boolean;
  /**
   * The size of the checkbox. Defaults to 'sm'.
   */
  size?: 'large' | 'medium' | 'small';
  weight?: 'regular' | 'medium';
}

const rubikWeightFactor: Record<NonNullable<ChevronProps['weight']>, number> = {
  regular: 1,
  medium: 1.4,
};

const chevronSizeMap: Record<NonNullable<ChevronProps['size']>, string> = {
  small: theme.fontSizeSmall,
  medium: theme.fontSizeMedium,
  large: theme.fontSizeLarge,
};

function getPath(direction: NonNullable<ChevronProps['direction']>) {
  // Base values for a downward chevron
  const base = [
    [3.5, 5.5],
    [7, 9],
    [10.5, 5.5],
  ] as const;

  switch (direction) {
    case 'right':
      // Switch X and Y axis (so `base[0][1]` goes before `base[0][1]`)
      return `M${base[0][1]} ${base[0][0]}L${base[1][1]} ${base[1][0]}L${base[2][1]} ${base[2][0]}`;
    case 'left':
      // Switch X and Y axis, then flip X axis (so 14 - …)
      return `M${14 - base[0][1]} ${base[0][0]}L${14 - base[1][1]} ${base[1][0]}L${14 - base[2][1]} ${base[2][0]}`;
    case 'up':
      // Flip Y axis (so 14 - …)
      return `M${base[0][0]} ${14 - base[0][1]}L${base[1][0]} ${14 - base[1][1]}L${base[2][0]} ${14 - base[2][1]}`;
    case 'down':
    default:
      return `M${base[0][0]} ${base[0][1]}L${base[1][0]} ${base[1][1]}L${base[2][0]} ${base[2][1]}`;
  }
}

function Chevron({
  size = 'medium',
  weight = 'regular',
  direction = 'down',
  light = false,
  ...props
}: ChevronProps) {
  return (
    <VariableWeightIcon
      viewBox="0 0 14 14"
      size={chevronSizeMap[size]}
      weightFactor={rubikWeightFactor[weight]}
      strokeOpacity={light ? 0.6 : 1}
      {...props}
    >
      <motion.path
        animate={{d: getPath(direction)}}
        transition={{ease: 'easeOut', duration: 0.25}}
        initial={false}
      />
    </VariableWeightIcon>
  );
}

const VariableWeightIcon = styled('svg')<{size: string; weightFactor: number}>`
  width: ${p => p.size};
  height: ${p => p.size};

  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: calc(${p => p.size} * 0.0875 * ${p => p.weightFactor});
`;

export {Chevron};
