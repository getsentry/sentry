import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconMenu(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M14.25 12C14.6642 12 15 12.3358 15 12.75C15 13.1642 14.6642 13.5 14.25 13.5H1.75C1.33579 13.5 1 13.1642 1 12.75C1 12.3358 1.33579 12 1.75 12H14.25ZM14.25 7C14.6642 7 15 7.33579 15 7.75C15 8.16421 14.6642 8.5 14.25 8.5H1.75C1.33579 8.5 1 8.16421 1 7.75C1 7.33579 1.33579 7 1.75 7H14.25ZM14.25 2C14.6642 2 15 2.33579 15 2.75C15 3.16421 14.6642 3.5 14.25 3.5H1.75C1.33579 3.5 1 3.16421 1 2.75C1 2.33579 1.33579 2 1.75 2H14.25Z" />
      ) : (
        <Fragment>
          <path d="M15.19,2.53H.81A.75.75,0,0,1,.81,1H15.19a.75.75,0,1,1,0,1.5Z" />
          <path d="M15.19,15H.81a.75.75,0,0,1,0-1.5H15.19a.75.75,0,1,1,0,1.5Z" />
          <path d="M15.19,8.75H.81a.75.75,0,1,1,0-1.5H15.19a.75.75,0,0,1,0,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
