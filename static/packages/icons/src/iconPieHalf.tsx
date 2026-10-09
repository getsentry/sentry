import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconPieHalf(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M8 3C10.76 3 13 5.24 13 8C13 10.76 10.76 13 8 13V3ZM8 0C12.42 0 16 3.58 16 8C16 12.42 12.42 16 8 16C3.58 16 0 12.42 0 8C0 3.58 3.58 0 8 0ZM8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 4.41 11.59 1.5 8 1.5Z"
      />
    </SvgIcon>
  );
}
