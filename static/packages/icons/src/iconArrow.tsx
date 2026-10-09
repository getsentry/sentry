import type {SVGIconDirection, SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export interface ArrowProps extends SVGIconProps {
  direction?: SVGIconDirection;
}

export function IconArrow({direction = 'up', ...props}: ArrowProps) {
  return (
    <SvgIcon
      {...props}
      style={
        direction
          ? direction === 'down'
            ? {transform: 'scale(1, -1)', ...props.style}
            : {
                transform: `rotate(${SvgIcon.ICON_DIRECTION_TO_ROTATION_ANGLE[direction] ?? 0}deg)`,
                ...props.style,
              }
          : props.style
      }
    >
      <path d="M12.79 6.74C13.08 7.04 13.07 7.51 12.76 7.79C12.46 8.08 11.99 8.07 11.71 7.76L8.75 4.64L8.75 13.25C8.75 13.66 8.41 14 8 14C7.59 14 7.25 13.66 7.25 13.25L7.25 4.63L4.29 7.76C4.01 8.07 3.54 8.08 3.24 7.79C2.93 7.51 2.92 7.04 3.21 6.74L7.46 2.24C7.46 2.23 7.46 2.23 7.46 2.23C7.47 2.22 7.48 2.21 7.48 2.21C7.51 2.18 7.54 2.16 7.57 2.13C7.58 2.13 7.59 2.12 7.6 2.12C7.63 2.1 7.67 2.08 7.7 2.06C7.71 2.06 7.72 2.06 7.73 2.05C7.81 2.02 7.9 2 8 2C8.1 2 8.19 2.02 8.28 2.05C8.29 2.06 8.29 2.06 8.3 2.06C8.34 2.08 8.37 2.1 8.4 2.12C8.41 2.12 8.42 2.13 8.43 2.14C8.46 2.16 8.48 2.18 8.51 2.2C8.52 2.21 8.53 2.22 8.54 2.23C8.54 2.23 8.54 2.23 8.54 2.24L12.79 6.74Z" />
    </SvgIcon>
  );
}
