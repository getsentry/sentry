import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconGrabbable(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M6 12C6.55 12 7 12.45 7 13C7 13.55 6.55 14 6 14C5.45 14 5 13.55 5 13C5 12.45 5.45 12 6 12ZM10 12C10.55 12 11 12.45 11 13C11 13.55 10.55 14 10 14C9.45 14 9 13.55 9 13C9 12.45 9.45 12 10 12ZM6 7C6.55 7 7 7.45 7 8C7 8.55 6.55 9 6 9C5.45 9 5 8.55 5 8C5 7.45 5.45 7 6 7ZM10 7C10.55 7 11 7.45 11 8C11 8.55 10.55 9 10 9C9.45 9 9 8.55 9 8C9 7.45 9.45 7 10 7ZM6 2C6.55 2 7 2.45 7 3C7 3.55 6.55 4 6 4C5.45 4 5 3.55 5 3C5 2.45 5.45 2 6 2ZM10 2C10.55 2 11 2.45 11 3C11 3.55 10.55 4 10 4C9.45 4 9 3.55 9 3C9 2.45 9.45 2 10 2Z" />
    </SvgIcon>
  );
}
