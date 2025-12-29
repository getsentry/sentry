import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconMenu(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M14.25 12C14.66 12 15 12.34 15 12.75C15 13.16 14.66 13.5 14.25 13.5H1.75C1.34 13.5 1 13.16 1 12.75C1 12.34 1.34 12 1.75 12H14.25ZM14.25 7C14.66 7 15 7.34 15 7.75C15 8.16 14.66 8.5 14.25 8.5H1.75C1.34 8.5 1 8.16 1 7.75C1 7.34 1.34 7 1.75 7H14.25ZM14.25 2C14.66 2 15 2.34 15 2.75C15 3.16 14.66 3.5 14.25 3.5H1.75C1.34 3.5 1 3.16 1 2.75C1 2.34 1.34 2 1.75 2H14.25Z" />
    </SvgIcon>
  );
}
