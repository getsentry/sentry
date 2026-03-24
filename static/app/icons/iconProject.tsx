import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconProject(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M6.52 0.5C7.05 0.5 7.55 0.74 7.89 1.16L9.29 2.91C9.33 2.97 9.4 3 9.48 3H14.25C15.22 3 16 3.78 16 4.75V12.25C16 13.22 15.22 14 14.25 14H1.75C0.78 14 0 13.22 0 12.25V2.25C0 1.28 0.78 0.5 1.75 0.5H6.52ZM1.75 2C1.61 2 1.5 2.11 1.5 2.25V12.25C1.5 12.39 1.61 12.5 1.75 12.5H14.25C14.39 12.5 14.5 12.39 14.5 12.25V4.75C14.5 4.61 14.39 4.5 14.25 4.5H9.48C8.95 4.5 8.45 4.26 8.11 3.84L6.71 2.09C6.67 2.03 6.6 2 6.52 2H1.75Z" />
    </SvgIcon>
  );
}
