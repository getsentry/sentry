import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconControl(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 2a.75.75 0 0 1 .545.235l4.25 4.5a.75.75 0 1 1-1.09 1.03L8 3.84 4.295 7.765a.75.75 0 0 1-1.09-1.03l4.25-4.5A.75.75 0 0 1 8 2" />
    </SvgIcon>
  );
}
