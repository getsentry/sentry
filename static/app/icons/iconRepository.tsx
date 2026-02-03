import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon} from 'sentry/icons/svgIcon';

export function IconRepository(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12.25 0C13.22 0 14 0.78 14 1.75V13.5C14 14.05 13.55 14.5 13 14.5H10.75C10.34 14.5 10 14.16 10 13.75C10 13.34 10.34 13 10.75 13H12.5V11.5H9V16L7 14L5 16V11.5H3.5V13.75C3.5 14.16 3.16 14.5 2.75 14.5C2.34 14.5 2 14.16 2 13.75V1.75C2 0.78 2.78 0 3.75 0H12.25ZM3.75 1.5C3.61 1.5 3.5 1.61 3.5 1.75V10H12.5V1.75C12.5 1.61 12.39 1.5 12.25 1.5H3.75Z" />
    </SvgIcon>
  );
}
