import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconSearch(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M6.75 0C10.48 0 13.5 3.02 13.5 6.75C13.5 8.34 12.95 9.81 12.02 10.96L15.78 14.72C16.07 15.01 16.07 15.49 15.78 15.78C15.49 16.07 15.01 16.07 14.72 15.78L10.96 12.02C9.81 12.95 8.34 13.5 6.75 13.5C3.02 13.5 0 10.48 0 6.75C0 3.02 3.02 0 6.75 0ZM6.75 1.5C3.85 1.5 1.5 3.85 1.5 6.75C1.5 9.65 3.85 12 6.75 12C9.65 12 12 9.65 12 6.75C12 3.85 9.65 1.5 6.75 1.5Z" />
    </SvgIcon>
  );
}
