import type {SVGIconDirection, SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  direction?: SVGIconDirection;
  isDouble?: boolean;
}

function getChevronPath({isDouble}: Pick<Props, 'isDouble'>) {
  if (isDouble) {
    return (
      <path d="M8 8C8.21 8 8.4 8.09 8.54 8.24L12.79 12.74C13.08 13.04 13.07 13.51 12.76 13.79C12.46 14.08 11.99 14.07 11.7 13.76L8 9.84L4.29 13.76C4.01 14.07 3.54 14.08 3.23 13.79C2.93 13.51 2.92 13.04 3.2 12.74L7.45 8.24C7.6 8.09 7.79 8 8 8ZM8 2C8.21 2 8.4 2.09 8.54 2.24L12.79 6.74C13.08 7.04 13.07 7.51 12.76 7.79C12.46 8.08 11.99 8.07 11.7 7.76L8 3.84L4.29 7.76C4.01 8.07 3.54 8.08 3.23 7.79C2.93 7.51 2.92 7.04 3.2 6.74L7.45 2.24C7.6 2.09 7.79 2 8 2ZZ" />
    );
  }
  return (
    <path d="M8 5C8.21 5 8.4 5.09 8.54 5.24L12.79 9.74C13.08 10.04 13.07 10.51 12.76 10.79C12.46 11.08 11.99 11.07 11.7 10.76L8 6.84L4.29 10.76C4.01 11.07 3.54 11.08 3.24 10.79C2.93 10.51 2.92 10.04 3.2 9.74L7.45 5.24C7.6 5.09 7.79 5 8 5Z" />
  );
}

export function IconChevron({isDouble, direction = 'up', ...props}: Props) {
  return (
    <SvgIcon
      {...props}
      style={
        direction
          ? {
              transform: `rotate(${SvgIcon.ICON_DIRECTION_TO_ROTATION_ANGLE[direction] ?? 0}deg)`,
              ...props.style,
            }
          : props.style
      }
    >
      {getChevronPath({isDouble})}
    </SvgIcon>
  );
}
