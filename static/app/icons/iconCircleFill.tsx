import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCircleFill(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <circle cx="8" cy="8" r="8" />
    </SvgIcon>
  );
}
