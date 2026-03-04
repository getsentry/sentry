import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon} from 'sentry/icons/svgIcon';

export function IconMerge(props: SVGIconProps) {
  return (
    <SvgIcon {...props}>
      <path d="M4.25 1a2.25 2.25 0 0 1 1.035 4.246l.88 2.005c.2.455.65.749 1.146.749h3.32a2.249 2.249 0 1 1 2.119 3c-.98 0-1.81-.627-2.12-1.5H7.31A2.75 2.75 0 0 1 5 8.24v2.39a2.249 2.249 0 1 1-3 2.12c0-.98.627-1.81 1.5-2.12V5.37a2.249 2.249 0 0 1 .75-4.37m0 11a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5m8.5-4a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5m-8.5-5.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5" />
    </SvgIcon>
  );
}
