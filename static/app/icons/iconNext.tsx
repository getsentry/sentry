import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconNext(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m10.25,7.57L3.5,3.67c-.33-.19-.75.05-.75.43v7.79c0,.38.42.63.75.43l6.75-3.9c.33-.19.33-.67,0-.87Z" />
          <line x1="13.25" y1="3" x2="13.25" y2="13" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M.75,15.48a.69.69,0,0,1-.37-.1A.73.73,0,0,1,0,14.73V1.27A.73.73,0,0,1,.38.62a.75.75,0,0,1,.74,0L12.78,7.35a.75.75,0,0,1,0,1.3L1.12,15.38A.69.69,0,0,1,.75,15.48ZM1.5,2.57V13.43L10.91,8Z" />
          <path d="M15.25,15.94a.76.76,0,0,1-.75-.75V.81a.75.75,0,1,1,1.5,0V15.19A.76.76,0,0,1,15.25,15.94Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
