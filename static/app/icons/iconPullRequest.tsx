import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon} from 'sentry/icons/svgIcon';

export function IconPullRequest(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M3.75 1a2.249 2.249 0 0 1 .75 4.37v5.26a2.249 2.249 0 1 1-3 2.12c0-.98.627-1.81 1.5-2.12V5.37a2.249 2.249 0 0 1 .75-4.37m0 11a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5m0-9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5M9.573.426A.25.25 0 0 1 10 .604V2.5h1.75c.966 0 1.75.783 1.75 1.75v6.38a2.249 2.249 0 0 1-.75 4.37 2.25 2.25 0 0 1-.75-4.37V4.25a.25.25 0 0 0-.25-.25H10v1.396a.25.25 0 0 1-.427.177L7.177 3.176a.25.25 0 0 1 0-.353zM12.75 12a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5" />
    </SvgIcon>
  );
}
