import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconBarAntennaOne(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4 8a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-.5.5H1.5a.5.5 0 0 1-.5-.5v-6a.5.5 0 0 1 .5-.5z" />
      <path
        d="M9.25 4a.5.5 0 0 1 .5.5v10a.5.5 0 0 1-.5.5h-2.5a.5.5 0 0 1-.5-.5v-10a.5.5 0 0 1 .5-.5zm5.5-3a.5.5 0 0 1 .5.5v13a.5.5 0 0 1-.5.5h-2.5a.5.5 0 0 1-.5-.5v-13a.5.5 0 0 1 .5-.5z"
        opacity={0.25}
      />
    </SvgIcon>
  );
}
