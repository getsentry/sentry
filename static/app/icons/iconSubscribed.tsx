import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconSubscribed(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 0C11.04 0 13.5 2.46 13.5 5.5V8.77L15.07 11.04C15.65 11.87 15.05 13 14.05 13H11.87C11.43 14.72 9.86 16 8 16C6.14 16 4.57 14.72 4.13 13H1.95C0.95 13 0.35 11.87 0.93 11.04L2.5 8.77V5.5C2.5 2.46 4.96 0 8 0ZM5.71 13C6.1 13.88 6.98 14.5 8 14.5C9.02 14.5 9.9 13.88 10.29 13H5.71ZM8 1.5C5.79 1.5 4 3.29 4 5.5V9C4 9.15 3.95 9.3 3.87 9.43L2.43 11.5H13.57L12.13 9.43C12.05 9.3 12 9.15 12 9V5.5C12 3.29 10.21 1.5 8 1.5Z" />
    </SvgIcon>
  );
}
