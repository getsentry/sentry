import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconSubscribed(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m12.25,9v-2.57c0-2.22-1.62-4.2-3.83-4.41-2.53-.24-4.67,1.75-4.67,4.23v2.75l-1.05,1.74c-.2.33.04.76.43.76h9.73c.39,0,.63-.42.43-.76l-1.05-1.74Z" />
          <path d="m10.5,11.5c0,1.38-1.12,2.5-2.5,2.5s-2.5-1.12-2.5-2.5" />
        </Fragment>
      ) : (
        <path d="M10.533 14.07h3.466a.76.76 0 0 0 .58-.28.74.74 0 0 0 .19-.57l-.57-6.55a.13.13 0 0 0 0-.06A6.42 6.42 0 0 0 8 0a6.42 6.42 0 0 0-6.18 6.65v.06l-.57 6.55a.74.74 0 0 0 .19.57.76.76 0 0 0 .56.24h3.468A2.64 2.64 0 0 0 8 16a2.64 2.64 0 0 0 2.533-1.93Zm-1.654 0H7.121a1.13 1.13 0 0 0 1.758 0Zm4.32-1.5H2.8l.5-5.79v-.13A4.92 4.92 0 0 1 8 1.54a4.92 4.92 0 0 1 4.7 5.11v.19l.5 5.73Z" />
      )}
    </SvgIcon>
  );
}
