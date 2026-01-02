import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCommit(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 4C9.86 4 11.43 5.27 11.87 7H15.25C15.66 7 16 7.34 16 7.75C16 8.16 15.66 8.5 15.25 8.5H11.97C11.72 10.47 10.04 12 8 12C5.96 12 4.28 10.47 4.03 8.5H0.75C0.34 8.5 0 8.16 0 7.75C0 7.34 0.34 7 0.75 7H4.13C4.57 5.27 6.14 4 8 4ZM8 5.5C6.62 5.5 5.5 6.62 5.5 8C5.5 9.38 6.62 10.5 8 10.5C9.38 10.5 10.5 9.38 10.5 8C10.5 6.62 9.38 5.5 8 5.5Z" />
    </SvgIcon>
  );
}
