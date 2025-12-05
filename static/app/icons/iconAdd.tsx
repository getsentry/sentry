import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconAdd(props: SVGIconProps) {
  return (
    <SvgIcon {...props} data-test-id="icon-add">
      <path d="M8 1C8.41 1 8.75 1.34 8.75 1.75V7.25H14.25C14.66 7.25 15 7.59 15 8C15 8.41 14.66 8.75 14.25 8.75H8.75V14.25C8.75 14.66 8.41 15 8 15C7.59 15 7.25 14.66 7.25 14.25V8.75H1.75C1.34 8.75 1 8.41 1 8C1 7.59 1.34 7.25 1.75 7.25H7.25V1.75C7.25 1.34 7.59 1 8 1Z" />
    </SvgIcon>
  );
}
