import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon} from 'sentry/icons/svgIcon';

export function IconBranch(props: SVGIconProps) {
  return (
    <SvgIcon {...props} data-test-id="icon-branch">
      <path d="M11.75 1a2.248 2.248 0 0 1 .75 4.368v.863a1.75 1.75 0 0 1-1.299 1.692L5.928 9.329A1.25 1.25 0 0 0 5 10.536v.095A2.248 2.248 0 0 1 4.25 15a2.25 2.25 0 0 1-.75-4.37V5.369A2.248 2.248 0 0 1 4.25 1 2.248 2.248 0 0 1 5 5.368V8.09c.17-.087.35-.16.541-.21l5.274-1.406A.25.25 0 0 0 11 6.23v-.863A2.248 2.248 0 0 1 11.75 1m-7.5 11a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5m0-9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5m7.5 0a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5" />
    </SvgIcon>
  );
}
