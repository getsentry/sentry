import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconNumber(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <line x1="5.25" y1="2.5" x2="5.25" y2="13.5" />
          <line x1="10.5" y1="2.5" x2="10.5" y2="13.5" />
          <line x1="13.38" y1="5.38" x2="2.38" y2="5.38" />
          <line x1="13.38" y1="10.62" x2="2.38" y2="10.62" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M15.24,5.36H.76a.75.75,0,0,1,0-1.5H15.24a.75.75,0,0,1,0,1.5Z" />
          <path d="M15.24,12.14H.76a.75.75,0,0,1,0-1.5H15.24a.75.75,0,1,1,0,1.5Z" />
          <path d="M4.61,16a.75.75,0,0,1-.75-.75V.76a.75.75,0,0,1,1.5,0V15.24A.76.76,0,0,1,4.61,16Z" />
          <path d="M11.39,16a.76.76,0,0,1-.75-.75V.76a.75.75,0,1,1,1.5,0V15.24A.75.75,0,0,1,11.39,16Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
