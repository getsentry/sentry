import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconEllipsis(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M2.5 6.5C3.33 6.5 4 7.17 4 8C4 8.83 3.33 9.5 2.5 9.5C1.67 9.5 1 8.83 1 8C1 7.17 1.67 6.5 2.5 6.5ZM8 6.5C8.83 6.5 9.5 7.17 9.5 8C9.5 8.83 8.83 9.5 8 9.5C7.17 9.5 6.5 8.83 6.5 8C6.5 7.17 7.17 6.5 8 6.5ZM13.5 6.5C14.33 6.5 15 7.17 15 8C15 8.83 14.33 9.5 13.5 9.5C12.67 9.5 12 8.83 12 8C12 7.17 12.67 6.5 13.5 6.5Z" />
    </SvgIcon>
  );
}
