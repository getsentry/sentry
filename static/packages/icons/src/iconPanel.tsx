import type {SVGIconDirection, SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  direction?: SVGIconDirection;
}

export function IconPanel({direction = 'up', ...props}: Props) {
  return (
    <SvgIcon
      {...props}
      style={{
        transform: direction
          ? `rotate(${SvgIcon.ICON_DIRECTION_TO_ROTATION_ANGLE[direction] ?? 0}deg)`
          : undefined,
        ...props.style,
      }}
    >
      <path d="M13.25 1C14.22 1 15 1.78 15 2.75V13.25C15 14.22 14.22 15 13.25 15H2.75C1.84 15 1.1 14.31 1.01 13.43L1 13.25V2.75C1 1.78 1.78 1 2.75 1H13.25ZM2.5 6V13.25L2.5 13.3C2.53 13.41 2.63 13.5 2.75 13.5H13.25C13.39 13.5 13.5 13.39 13.5 13.25V6H2.5ZM2.75 2.5C2.61 2.5 2.5 2.61 2.5 2.75V4.5H13.5V2.75C13.5 2.61 13.39 2.5 13.25 2.5H2.75Z" />
    </SvgIcon>
  );
}
