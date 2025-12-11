import type {SVGIconDirection, SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  direction?: Exclude<SVGIconDirection, 'left' | 'right'>;
}

export function IconThumb({direction = 'up', ...props}: Props) {
  return (
    <SvgIcon
      {...props}
      style={
        direction === 'down'
          ? {
              transition: 'transform 120ms ease-in-out',
              transform: `rotate(${SvgIcon.ICON_DIRECTION_TO_ROTATION_ANGLE[direction] ?? 0}deg)`,
              ...props.style,
            }
          : props.style
      }
    >
      <path d="M8.38 0C9.55 0 10.49 0.95 10.49 2.11V5H12C13.92 5 15.28 6.61 14.95 8.54L14.95 8.54L14.4 12.46C14.4 12.47 14.4 12.49 14.4 12.5C14.12 14.02 12.82 15 11.36 15H1.75C1.34 15 1 14.66 1 14.25V5.75C1 5.34 1.34 5 1.75 5H4.77L6.45 1.25C6.8 0.49 7.55 0 8.38 0ZM2.5 13.5H4.5V6.5H2.5V13.5ZM8.38 1.5C8.14 1.5 7.92 1.64 7.82 1.86L6 5.91V13.5H11.36C12.14 13.5 12.77 13 12.92 12.23L13.47 8.33L13.47 8.3C13.66 7.27 12.99 6.5 12 6.5H9.74C9.33 6.5 8.99 6.16 8.99 5.75V2.11C8.99 1.77 8.72 1.5 8.38 1.5Z" />
    </SvgIcon>
  );
}
