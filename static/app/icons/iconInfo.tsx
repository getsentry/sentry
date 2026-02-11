import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconInfo(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 0C12.42 0 16 3.58 16 8C16 12.42 12.42 16 8 16C3.58 16 0 12.42 0 8C0 3.58 3.58 0 8 0ZM8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 4.41 11.59 1.5 8 1.5ZM8 7C8.41 7 8.75 7.34 8.75 7.75V11.25C8.75 11.66 8.41 12 8 12C7.59 12 7.25 11.66 7.25 11.25V7.75C7.25 7.34 7.59 7 8 7ZM8 4C8.55 4 9 4.45 9 5C9 5.55 8.55 6 8 6C7.45 6 7 5.55 7 5C7 4.45 7.45 4 8 4Z" />
    </SvgIcon>
  );
}
