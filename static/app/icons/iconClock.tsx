import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconClock(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 0C12.42 0 16 3.58 16 8C16 12.42 12.42 16 8 16C3.58 16 0 12.42 0 8C0 3.58 3.58 0 8 0ZM8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 4.41 11.59 1.5 8 1.5ZM7.75 4C8.16 4 8.5 4.34 8.5 4.75V8.11L10.68 9.64C11.02 9.87 11.1 10.34 10.86 10.68C10.63 11.02 10.16 11.1 9.82 10.86L7.32 9.11L7 8.89V4.75C7 4.34 7.34 4 7.75 4Z" />
    </SvgIcon>
  );
}
