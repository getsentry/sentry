import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconShift(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M7.47 1.22a.75.75 0 0 1 1.06 0l6.25 6.25a.75.75 0 0 1-.53 1.28h-2.5v4c0 1.008-.798 1.75-1.75 1.75H6c-.936 0-1.75-.813-1.75-1.75v-4h-2.5a.751.751 0 0 1-.53-1.28zM3.561 7.25H5a.75.75 0 0 1 .75.75v4.75c0 .033.018.1.084.166A.26.26 0 0 0 6 13h4c.082 0 .144-.03.182-.067a.25.25 0 0 0 .067-.183V8a.75.75 0 0 1 .75-.75h1.44L8 2.81z" />
    </SvgIcon>
  );
}
