import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

/**
 * @deprecated Use IconLightning instead, this icon will be removed in new UI.
 */
export function IconBusiness(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M8 0C12.42 0 16 3.58 16 8C16 12.42 12.42 16 8 16C3.58 16 0 12.42 0 8C0 3.58 3.58 0 8 0ZM8 1.5C4.41 1.5 1.5 4.41 1.5 8C1.5 11.59 4.41 14.5 8 14.5C11.59 14.5 14.5 11.59 14.5 8C14.5 4.41 11.59 1.5 8 1.5ZM8.62 3.6C8.8 3.43 9.1 3.6 9.04 3.84L8.33 6.69C8.29 6.85 8.41 7 8.57 7H12.38C12.6 7 12.71 7.27 12.55 7.43L7.38 12.4C7.2 12.57 6.9 12.4 6.96 12.16L7.67 9.31C7.71 9.15 7.59 9 7.43 9H3.62C3.4 9 3.29 8.73 3.45 8.57L8.62 3.6Z" />
    </SvgIcon>
  );
}
