import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

/**
 * @deprecated This icon will be removed in new UI.
 */
export function IconExclamation(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 0C12.42 0 16 3.58 16 8C16 12.42 12.42 16 8 16C3.58 16 0 12.42 0 8C0 3.58 3.58 0 8 0ZM8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 4.41 11.59 1.5 8 1.5ZM8 10C8.55 10 9 10.45 9 11C9 11.55 8.55 12 8 12C7.45 12 7 11.55 7 11C7 10.45 7.45 10 8 10ZM8 4C8.41 4 8.75 4.34 8.75 4.75V8.25C8.75 8.66 8.41 9 8 9C7.59 9 7.25 8.66 7.25 8.25V4.75C7.25 4.34 7.59 4 8 4Z" />
    </SvgIcon>
  );
}
