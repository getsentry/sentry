import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconGraphHeatmap(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M1.75 1c.41 0 .75.34.75.75v11.5c0 .14.11.25.25.25h11.5a.75.75 0 0 1 0 1.5H2.75C1.78 15 1 14.22 1 13.25V1.75c0-.41.34-.75.75-.75" />
      <path d="M8 9a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-1a1 1 0 0 1 1-1zm5-3a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1zM8 3a1 1 0 0 1 1 1v1a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" />
    </SvgIcon>
  );
}
