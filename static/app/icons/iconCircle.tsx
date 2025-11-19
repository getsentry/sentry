import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCircle(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C1.77176e-07 3.58172 3.58172 1.7717e-07 8 0ZM8 1.5C4.41015 1.5 1.5 4.41015 1.5 8C1.5 11.5899 4.41015 14.5 8 14.5C11.5899 14.5 14.5 11.5899 14.5 8C14.5 4.41015 11.5899 1.5 8 1.5Z" />
    </SvgIcon>
  );
}
