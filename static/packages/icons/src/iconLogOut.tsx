import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconLogOut(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        d="M9.5 1.75h3.75c.55 0 1 .45 1 1v10.5c0 .55-.45 1-1 1H9.5M7.25 4.5 3.75 8l3.5 3.5M3.75 8h7.5"
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </SvgIcon>
  );
}
