import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconTag(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8.5 1C8.7 1 8.9 1.08 9.04 1.23L15.79 8.23C16.07 8.52 16.07 8.99 15.78 9.28L9.28 15.78C8.99 16.07 8.52 16.07 8.23 15.79L1.23 9.04C1.08 8.9 1 8.7 1 8.5V2.25C1 1.56 1.56 1 2.25 1H8.5ZM2.5 8.18L8.74 14.2L14.2 8.74L8.18 2.5H2.5V8.18ZM5.5 4C6.33 4 7 4.67 7 5.5C7 6.33 6.33 7 5.5 7C4.67 7 4 6.33 4 5.5C4 4.67 4.67 4 5.5 4Z" />
    </SvgIcon>
  );
}
