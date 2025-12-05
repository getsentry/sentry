import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconNext(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M14.25 1C14.66 1 15 1.34 15 1.75V14.25C15 14.66 14.66 15 14.25 15C13.84 15 13.5 14.66 13.5 14.25V1.75C13.5 1.34 13.84 1 14.25 1ZM1.39 1.09C1.64 0.96 1.93 0.97 2.16 1.12L11.66 7.37C11.87 7.51 12 7.75 12 8C12 8.25 11.87 8.49 11.66 8.63L2.16 14.88C1.93 15.03 1.64 15.04 1.39 14.91C1.15 14.78 1 14.53 1 14.25V1.75C1 1.47 1.15 1.22 1.39 1.09ZM2.5 12.86L9.88 8L2.5 3.14V12.86Z" />
    </SvgIcon>
  );
}
