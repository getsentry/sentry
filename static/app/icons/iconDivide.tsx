import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconDivide(props: SVGIconProps) {
  return (
    <SvgIcon {...props} data-test-id="icon-divide">
      <path d="M8 12C8.55 12 9 12.45 9 13C9 13.55 8.55 14 8 14C7.45 14 7 13.55 7 13C7 12.45 7.45 12 8 12ZM14.25 7.25C14.66 7.25 15 7.59 15 8C15 8.41 14.66 8.75 14.25 8.75H1.75C1.34 8.75 1 8.41 1 8C1 7.59 1.34 7.25 1.75 7.25H14.25ZM8 2C8.55 2 9 2.45 9 3C9 3.55 8.55 4 8 4C7.45 4 7 3.55 7 3C7 2.45 7.45 2 8 2Z" />
    </SvgIcon>
  );
}
