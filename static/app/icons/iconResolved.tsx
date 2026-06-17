import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconResolved(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 0C12.42 0 16 3.58 16 8C16 12.42 12.42 16 8 16C3.58 16 0 12.42 0 8C0 3.58 3.58 0 8 0ZM12.3 5.74C12.01 5.43 11.54 5.42 11.24 5.7L6.96 9.73L4.76 7.7C4.45 7.42 3.98 7.44 3.7 7.74C3.42 8.05 3.44 8.52 3.74 8.8L6.46 11.3C6.75 11.57 7.2 11.57 7.48 11.3L12.26 6.8C12.57 6.51 12.58 6.04 12.3 5.74Z" />
    </SvgIcon>
  );
}
