import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCheckmark(props: SVGIconProps) {
  return (
    <SvgIcon {...props} data-test-id="icon-check-mark">
      <path d="M13.72 3.22C14.01 2.93 14.49 2.93 14.78 3.22C15.07 3.51 15.07 3.99 14.78 4.28L6.53 12.53C6.24 12.82 5.76 12.82 5.47 12.53L1.22 8.28C0.93 7.99 0.93 7.51 1.22 7.22C1.51 6.93 1.99 6.93 2.28 7.22L6 10.94L13.72 3.22Z" />
    </SvgIcon>
  );
}
