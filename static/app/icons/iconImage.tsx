import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconImage(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <rect x="3" y="3" width="10" height="10" rx="1" ry="1" />
          <polyline points="3 11 5.25 8.75 6.75 10.25 9.38 7.62" />
          <line x1="9.5" y1="7.75" x2="13" y2="11.25" />
          <circle cx="6.25" cy="6" r=".25" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M4.37 7.32a2.06 2.06 0 1 1 2.06-2 2.05 2.05 0 0 1-2.06 2Zm0-2.61a.56.56 0 1 0 0 1.12.56.56 0 0 0 0-1.12Z" />
          <path d="M2.75 16.03h10.5A2.75 2.75 0 0 0 16 13.28V2.78A2.75 2.75 0 0 0 13.25.03H2.75A2.75 2.75 0 0 0 0 2.78v10.5a2.75 2.75 0 0 0 2.75 2.75ZM1.866 1.896a1.25 1.25 0 0 1 .884-.366h10.5a1.25 1.25 0 0 1 1.25 1.25v8.266L10.56 6.57a.75.75 0 0 0-.56-.25.85.85 0 0 0-.55.24l-3 3.25-1.53-1.27a.75.75 0 0 0-1 0L1.5 11.112V2.78c0-.332.132-.65.366-.884ZM1.5 13.276a.64.64 0 0 0 .02-.016l3-3.16L6 11.42a.75.75 0 0 0 1-.05l3-3.18 4.44 5.05a.77.77 0 0 0 .06.06 1.25 1.25 0 0 1-1.25 1.23H2.75a1.25 1.25 0 0 1-1.25-1.25v-.004Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
