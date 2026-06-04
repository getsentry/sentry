import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

/**
 * @deprecated This icon will be removed in new UI.
 */
export function IconDiamond(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M7.4 0.17C7.7 -0.07 8.13 -0.05 8.41 0.22L15.53 7.34C15.82 7.64 15.82 8.11 15.53 8.41L8.41 15.53C8.11 15.82 7.64 15.82 7.34 15.53L0.22 8.41C-0.07 8.11 -0.07 7.64 0.22 7.34L7.34 0.22L7.4 0.17ZM1.81 7.88L7.88 13.94L13.94 7.88L7.88 1.81L1.81 7.88Z" />
    </SvgIcon>
  );
}
