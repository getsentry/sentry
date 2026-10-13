import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconReturn(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M13.25 4a.75.75 0 0 1 .75.75v3.249a1.75 1.75 0 0 1-1.75 1.75H4.635l2.005 1.893a.75.75 0 1 1-1.03 1.09L2.235 9.543l-.007-.009a1 1 0 0 1-.096-.112l-.01-.017a1 1 0 0 1-.06-.11l-.01-.023a.75.75 0 0 1-.017-.5l.024-.066.004-.01a1 1 0 0 1 .055-.1l.018-.027a1 1 0 0 1 .092-.108l.007-.008L5.61 5.267a.75.75 0 1 1 1.03 1.09L4.635 8.248h7.615a.25.25 0 0 0 .25-.25V4.75a.75.75 0 0 1 .75-.75" />
    </SvgIcon>
  );
}
