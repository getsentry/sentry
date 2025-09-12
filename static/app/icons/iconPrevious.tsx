import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconPrevious(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m5.75,8.43l6.75,3.9c.33.19.75-.05.75-.43v-7.79c0-.38-.42-.63-.75-.43l-6.75,3.9c-.33.19-.33.67,0,.87Z" />
          <line x1="2.75" y1="13" x2="2.75" y2="3" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M15.25,15.48a.69.69,0,0,1-.37-.1L3.22,8.65a.75.75,0,0,1,0-1.3L14.88.62a.75.75,0,0,1,.74,0,.73.73,0,0,1,.38.65V14.73a.73.73,0,0,1-.38.65A.69.69,0,0,1,15.25,15.48ZM5.09,8l9.41,5.43V2.57Z" />
          <path d="M.75,15.94A.76.76,0,0,1,0,15.19V.81A.76.76,0,0,1,.75.06.76.76,0,0,1,1.5.81V15.19A.76.76,0,0,1,.75,15.94Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
