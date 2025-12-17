import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconNot(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 0C12.42 0 16 3.58 16 8C16 12.42 12.42 16 8 16C3.58 16 0 12.42 0 8C0 3.58 3.58 0 8 0ZM3.97 13.09C5.07 13.97 6.48 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 6.48 13.97 5.07 13.09 3.97L3.97 13.09ZM8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 9.52 2.03 10.92 2.91 12.03L12.03 2.91C10.92 2.03 9.52 1.5 8 1.5Z" />
    </SvgIcon>
  );
}
