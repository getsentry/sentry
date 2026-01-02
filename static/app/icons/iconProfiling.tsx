import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconProfiling(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12.75 0C13.44 0 14 0.56 14 1.25V4.75C14 5.44 13.44 6 12.75 6H11V9.25C11 9.94 10.44 10.5 9.75 10.5H8.5V13.75C8.5 14.44 7.94 15 7.25 15H3.25C2.56 15 2 14.44 2 13.75V1.25C2 0.56 2.56 0 3.25 0H12.75ZM3.5 13.5H7V10.5H3.5V13.5ZM3.5 9H9.5V6H3.5V9ZM3.5 4.5H12.5V1.5H3.5V4.5Z" />
    </SvgIcon>
  );
}
