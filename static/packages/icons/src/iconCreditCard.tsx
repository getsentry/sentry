import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCreditCard(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M14.25 2c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0 1 14.25 14H1.75A1.75 1.75 0 0 1 0 12.25v-8.5C0 2.784.784 2 1.75 2zM1.5 8v4.25c0 .138.112.25.25.25h12.5a.25.25 0 0 0 .25-.25V8zm.25-4.5a.25.25 0 0 0-.25.25V5.5h13V3.75a.25.25 0 0 0-.25-.25z" />
    </SvgIcon>
  );
}
