import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconMobile(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M10.25 0C11.77 0 13 1.23 13 2.75V12.75C13 14.27 11.77 15.5 10.25 15.5H5.75C4.23 15.5 3 14.27 3 12.75V2.75C3 1.23 4.23 0 5.75 0H10.25ZM5.75 1.5C5.06 1.5 4.5 2.06 4.5 2.75V12.75C4.5 13.44 5.06 14 5.75 14H10.25C10.94 14 11.5 13.44 11.5 12.75V2.75C11.5 2.06 10.94 1.5 10.25 1.5H9.5V3C9.5 3.55 9.05 4 8.5 4H7.5C6.95 4 6.5 3.55 6.5 3V1.5H5.75Z" />
    </SvgIcon>
  );
}
