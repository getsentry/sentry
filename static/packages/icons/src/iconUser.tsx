import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconUser(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 1A4 4 0 0 1 10.59 8.05C12.6 8.98 14 11.02 14 13.39C14 14.28 13.28 15 12.39 15H3.61C2.72 15 2 14.28 2 13.39C2 11.02 3.4 8.98 5.41 8.05A4 4 0 0 1 8 1ZM7.89 9C5.47 9 3.5 10.97 3.5 13.39C3.5 13.45 3.55 13.5 3.61 13.5H12.39C12.45 13.5 12.5 13.45 12.5 13.39C12.5 10.97 10.53 9 8.11 9H7.89ZM8 2.5A2.5 2.5 0 1 0 8 7.5A2.5 2.5 0 1 0 8 2.5Z" />
    </SvgIcon>
  );
}
