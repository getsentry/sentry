import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon} from 'sentry/icons/svgIcon';

export function IconRepository(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M12.25 0C13.216 0 14 .784 14 1.75V13.5a1 1 0 0 1-1 1h-2.25a.75.75 0 0 1 0-1.5h1.75v-1.5H9v3.896a.25.25 0 0 1-.427.177L7 14l-1.573 1.573A.25.25 0 0 1 5 15.396V11.5H3.5v2.25a.75.75 0 0 1-1.5 0v-11A2.75 2.75 0 0 1 4.75 0zm-7.5 1.5c-.69 0-1.25.56-1.25 1.25V10h9V1.75a.25.25 0 0 0-.25-.25z" />
    </SvgIcon>
  );
}
