import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconRefresh(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 16C3.58 16 0 12.42 0 8C0 3.58 3.58 0 8 0C10.42 0 12.59 1.07 14.05 2.77L15.57 1.25C15.73 1.09 16 1.2 16 1.42V5.75C16 5.89 15.89 6 15.75 6H11.42C11.2 6 11.09 5.73 11.25 5.57L12.99 3.83C11.79 2.41 10 1.5 8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.37 14.5 14.13 11.95 14.47 8.67C14.51 8.26 14.88 7.96 15.29 8C15.7 8.05 16 8.41 15.96 8.83C15.55 12.86 12.14 16 8 16Z" />
    </SvgIcon>
  );
}
