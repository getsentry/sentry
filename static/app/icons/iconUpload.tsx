import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconUpload(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m13.25,9v3.25c0,.55-.45,1-1,1H3.75c-.55,0-1-.45-1-1v-3.25" />
          <path d="m4.51,5.51l3.15-3.15c.2-.2.51-.2.71,0l3.25,3.25" />
          <line x1="7.98" y1="10.25" x2="8" y2="2.25" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M15.24,16H.76A.76.76,0,0,1,0,15.27V9.74A.76.76,0,0,1,.76,9a.76.76,0,0,1,.75.75v4.78h13V9.74a.75.75,0,0,1,1.5,0v5.53A.76.76,0,0,1,15.24,16Z" />
          <path d="M12.15,5.86a.74.74,0,0,1-.53-.22L8,2,4.38,5.64A.75.75,0,0,1,3.32,4.58L7.47.43a.75.75,0,0,1,1.06,0l4.15,4.15a.75.75,0,0,1,0,1.06A.73.73,0,0,1,12.15,5.86Z" />
          <path d="M8,12.08a.76.76,0,0,1-.75-.75V1a.75.75,0,0,1,1.5,0V11.33A.76.76,0,0,1,8,12.08Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
