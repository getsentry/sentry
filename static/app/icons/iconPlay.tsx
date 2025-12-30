import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconPlay(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M2.39 0.09C2.63 -0.04 2.92 -0.03 3.15 0.11L14.65 7.36C14.87 7.5 15 7.74 15 8C15 8.26 14.87 8.5 14.65 8.63L3.15 15.88C2.92 16.03 2.63 16.04 2.39 15.91C2.15 15.77 2 15.52 2 15.25V0.75C2 0.48 2.15 0.23 2.39 0.09ZM3.5 13.89L12.84 8L3.5 2.11V13.89Z" />
    </SvgIcon>
  );
}
