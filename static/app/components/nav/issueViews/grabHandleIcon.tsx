import {forwardRef} from 'react';

import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon} from 'sentry/icons/svgIcon';

const GrabHandleIcon = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <circle cx="5" cy="2" r="1.5" />
      <circle cx="11" cy="2" r="1.5" />

      <circle cx="5" cy="8" r="1.5" />
      <circle cx="11" cy="8" r="1.5" />

      <circle cx="5" cy="14" r="1.5" />
      <circle cx="11" cy="14" r="1.5" />
    </SvgIcon>
  );
});

GrabHandleIcon.displayName = 'GrabHandleIcon';

export {GrabHandleIcon};
