import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconFile(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M7.34 0C7.97 0 8.57 0.27 9 0.73L13.41 5.56C13.79 5.98 14 6.52 14 7.08V14C14 14.55 13.55 15 13 15H3C2.45 15 2 14.55 2 14V1.75C2 0.78 2.78 0 3.75 0H7.34ZM3.75 1.5C3.61 1.5 3.5 1.61 3.5 1.75V13.5H12.5V8H8C7.45 8 7 7.55 7 7V1.5H3.75ZM8.5 6.5H12.23L8.5 2.41V6.5Z" />
    </SvgIcon>
  );
}
