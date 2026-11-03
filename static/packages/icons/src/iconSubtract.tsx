import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconSubtract(props: SVGIconProps) {
  return (
    <SvgIcon {...props} data-test-id="icon-subtract">
      <path d="M14.25 7.25C14.66 7.25 15 7.59 15 8C15 8.41 14.66 8.75 14.25 8.75H1.75C1.34 8.75 1 8.41 1 8C1 7.59 1.34 7.25 1.75 7.25H14.25Z" />
    </SvgIcon>
  );
}
