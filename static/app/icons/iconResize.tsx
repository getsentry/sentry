import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconResize(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <line x1="3" y1="3" x2="13" y2="13" />
          <polyline points="13.25 8 13.25 13.25 8 13.25" />
          <polyline points="2.75 8 2.75 2.75 8 2.75" />
        </Fragment>
      ) : (
        <path d="M1.5,2.61l12,11.9H8A.75.75,0,0,0,8,16h7.25a.75.75,0,0,0,.75-.75V8a.75.75,0,0,0-1.5,0v5.43L2.57,1.55H8A.75.75,0,0,0,8,.05H.75A.76.76,0,0,0,0,.8V8a.75.75,0,0,0,.75.75A.74.74,0,0,0,1.5,8Z" />
      )}
    </SvgIcon>
  );
}
