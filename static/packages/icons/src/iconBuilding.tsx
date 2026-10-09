import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconBuilding(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4.5 7a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zM8.5 7a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zM4.5 3a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5zM8.5 3a.5.5 0 0 1 .5.5v1a.5.5 0 0 1-.5.5h-1a.5.5 0 0 1-.5-.5v-1a.5.5 0 0 1 .5-.5z" />
      <path d="M11 0c.559 0 1 .456 1 1.002V6h3a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-2H5v2a1 1 0 0 1-1 1H1a1 1 0 0 1-1-1V1a1 1 0 0 1 1-1zm1 13.5h2.5v-6H12zm-10.5 0h2v-2a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2h2v-12h-9z" />
    </SvgIcon>
  );
}
