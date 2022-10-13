import {forwardRef} from 'react';

import {SvgIcon, SVGIconProps} from './svgIcon';

const IconUnsubscribed = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref}>
      <path d="M10.533 14.07h3.466a.76.76 0 0 0 .58-.28.74.74 0 0 0 .19-.57l-.57-6.55a.13.13 0 0 0 0-.06A6.42 6.42 0 0 0 8 0a6.42 6.42 0 0 0-6.18 6.65v.06l-.57 6.55a.74.74 0 0 0 .19.57.76.76 0 0 0 .56.24h3.468A2.64 2.64 0 0 0 8 16a2.64 2.64 0 0 0 2.533-1.93Zm-1.654 0H7.121a1.13 1.13 0 0 0 1.758 0Zm4.32-1.5H2.8l.5-5.79v-.13A4.92 4.92 0 0 1 8 1.54a4.92 4.92 0 0 1 4.7 5.11v.19l.5 5.73Z" />
      <path d="M.801 16.5a.798.798 0 0 1-.563-.234.786.786 0 0 1 0-1.127L14.635.733a.798.798 0 0 1 1.127 0 .787.787 0 0 1 0 1.127L1.365 16.266A.84.84 0 0 1 .8 16.5Z" />
    </SvgIcon>
  );
});

IconUnsubscribed.displayName = 'IconUnsubscribed';

export {IconUnsubscribed};
