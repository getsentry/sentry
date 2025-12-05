import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconSpan(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8.75 0.5C9.44 0.5 10 1.06 10 1.75V5H11.25C11.94 5 12.5 5.56 12.5 6.25V9.5H13.75C14.44 9.5 15 10.06 15 10.75V14.25C15 14.94 14.44 15.5 13.75 15.5H7.25C6.56 15.5 6 14.94 6 14.25V11H4.75C4.06 11 3.5 10.44 3.5 9.75V6.5H2.25C1.56 6.5 1 5.94 1 5.25V1.75C1 1.06 1.56 0.5 2.25 0.5H8.75ZM7.5 14H13.5V11H7.5V14ZM5 9.5H11V6.5H5V9.5ZM2.5 5H8.5V2H2.5V5Z" />
    </SvgIcon>
  );
}
