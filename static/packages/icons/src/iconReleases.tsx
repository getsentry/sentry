import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconReleases(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M11.25 0.5C11.94 0.5 12.5 1.06 12.5 1.75V3H12.75C13.44 3 14 3.56 14 4.25V6H14.75C15.44 6 16 6.56 16 7.25V13.75C16 14.44 15.44 15 14.75 15H1.25C0.56 15 0 14.44 0 13.75V7.25C0 6.56 0.56 6 1.25 6H2V4.25C2 3.56 2.56 3 3.25 3H3.5V1.75C3.5 1.06 4.06 0.5 4.75 0.5H11.25ZM1.5 13.5H14.5V7.5H1.5V13.5ZM3.5 6H12.5V4.5H3.5V6ZM5 3H11V2H5V3Z" />
    </SvgIcon>
  );
}
