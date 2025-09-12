import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconUnsubscribed(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m6,2.5c.71-.38,1.54-.56,2.42-.48,2.21.21,3.83,2.19,3.83,4.41v2.07" />
          <line x1="5.5" y1="11.5" x2="8.04" y2="11.5" />
          <path d="m3.75,7.21v1.79l-1.05,1.74c-.2.33.04.76.43.76h2.37" />
          <path d="m5.5,11.5c0,1.38,1.12,2.5,2.5,2.5.7,0,1.33-.29,1.78-.75" />
          <line x1="2.75" y1="2.75" x2="13.25" y2="13.25" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M10.533 14.07h3.466a.76.76 0 0 0 .58-.28.74.74 0 0 0 .19-.57l-.57-6.55a.13.13 0 0 0 0-.06A6.42 6.42 0 0 0 8 0a6.42 6.42 0 0 0-6.18 6.65v.06l-.57 6.55a.74.74 0 0 0 .19.57.76.76 0 0 0 .56.24h3.468A2.64 2.64 0 0 0 8 16a2.64 2.64 0 0 0 2.533-1.93Zm-1.654 0H7.121a1.13 1.13 0 0 0 1.758 0Zm4.32-1.5H2.8l.5-5.79v-.13A4.92 4.92 0 0 1 8 1.54a4.92 4.92 0 0 1 4.7 5.11v.19l.5 5.73Z" />
          <path d="M.801 16.5a.798.798 0 0 1-.563-.234.786.786 0 0 1 0-1.127L14.635.733a.798.798 0 0 1 1.127 0 .787.787 0 0 1 0 1.127L1.365 16.266A.84.84 0 0 1 .8 16.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
