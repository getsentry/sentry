import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconOption(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M5.632 2c.746 0 1.41.474 1.654 1.18l3.328 9.651c.035.1.13.169.237.169h3.399a.75.75 0 0 1 0 1.5h-3.4a1.75 1.75 0 0 1-1.654-1.18L5.868 3.67a.25.25 0 0 0-.236-.169H1.75a.75.75 0 0 1 0-1.5zm8.618 0a.75.75 0 0 1 0 1.5h-4.5a.75.75 0 0 1 0-1.5z" />
    </SvgIcon>
  );
}
