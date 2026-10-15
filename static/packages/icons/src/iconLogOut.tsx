import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconLogOut(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M9 1.75A.75.75 0 0 1 9.75 1h3c.967 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 12.75 15h-3a.75.75 0 0 1 0-1.5h3a.25.25 0 0 0 .25-.25V2.75a.25.25 0 0 0-.25-.25h-3A.75.75 0 0 1 9 1.75" />
      <path d="M0 8a.75.75 0 0 1 .236-.545l4.5-4.25a.75.75 0 1 1 1.029 1.09L2.63 7.255l7.621.018a.75.75 0 0 1-.003 1.5L2.64 8.755l3.125 2.95a.75.75 0 1 1-1.03 1.09l-4.5-4.25A.75.75 0 0 1 0 8" />
    </SvgIcon>
  );
}
