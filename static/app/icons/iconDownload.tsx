import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconDownload(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m13.25,9.25v3c0,.55-.45,1-1,1H3.75c-.55,0-1-.45-1-1v-3" />
          <line x1="8" y1="2" x2="8" y2="10" />
          <path d="m11.18,7.43l-2.47,2.47c-.39.39-1.02.39-1.41,0l-2.47-2.47" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M15.24,16H.76A.76.76,0,0,1,0,15.27V9.74A.76.76,0,0,1,.76,9a.76.76,0,0,1,.75.75v4.78h13V9.74a.75.75,0,0,1,1.5,0v5.53A.76.76,0,0,1,15.24,16Z" />
          <path d="M8,12.08a.79.79,0,0,1-.53-.22L3.32,7.71a.77.77,0,0,1,0-1.07.75.75,0,0,1,1.06,0L8,10.27l3.62-3.63a.75.75,0,0,1,1.06,0,.77.77,0,0,1,0,1.07L8.53,11.86A.79.79,0,0,1,8,12.08Z" />
          <path d="M8,12.08a.76.76,0,0,1-.75-.75V1a.75.75,0,0,1,1.5,0V11.33A.76.76,0,0,1,8,12.08Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
