import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconFlag(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M2.75 0C3.16 0 3.5 0.34 3.5 0.75V2H15.25C15.55 2 15.82 2.18 15.94 2.45C16.05 2.72 16 3.04 15.8 3.26L12.77 6.5L15.8 9.74C16 9.96 16.05 10.28 15.94 10.55C15.82 10.82 15.55 11 15.25 11H3.5V14.25C3.5 14.66 3.16 15 2.75 15C2.34 15 2 14.66 2 14.25V0.75C2 0.34 2.34 0 2.75 0ZM3.5 9.5H13.52L11.2 7.01C10.93 6.72 10.93 6.28 11.2 5.99L13.52 3.5H3.5V9.5Z" />
    </SvgIcon>
  );
}
