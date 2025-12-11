import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconMail(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M14.25 2C15.22 2 16 2.78 16 3.75V12.25C16 13.22 15.22 14 14.25 14H1.75C0.78 14 0 13.22 0 12.25V3.75C0 2.78 0.78 2 1.75 2H14.25ZM8.88 10.18C8.4 10.66 7.6 10.66 7.12 10.18L6 9.06L2.56 12.5H13.44L10 9.06L8.88 10.18ZM1.5 11.44L4.94 8L1.5 4.56V11.44ZM11.06 8L14.5 11.44V4.56L11.06 8ZM8 8.94L13.44 3.5H2.56L8 8.94Z" />
    </SvgIcon>
  );
}
