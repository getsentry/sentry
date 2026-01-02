import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon} from 'sentry/icons/svgIcon';

export function IconBranch(props: SVGIconProps) {
  return (
    <SvgIcon {...props} data-test-id="icon-branch">
      <path d="M12 0C13.1 0 14 0.9 14 2C14 2.74 13.6 3.38 13 3.73V4.75C13 6.82 11.32 8.5 9.25 8.5H7.25C6.01 8.5 5 9.51 5 10.75V11.27C5.6 11.62 6 12.26 6 13C6 14.1 5.1 15 4 15C2.9 15 2 14.1 2 13C2 12.07 2.64 11.29 3.5 11.07V3.93C2.64 3.71 2 2.93 2 2C2 0.9 2.9 0 4 0C5.1 0 6 0.9 6 2C6 2.74 5.6 3.38 5 3.73V7.75C5.63 7.28 6.41 7 7.25 7H9.25C10.49 7 11.5 5.99 11.5 4.75V3.93C10.64 3.71 10 2.93 10 2C10 0.9 10.9 0 12 0Z" />
    </SvgIcon>
  );
}
