import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconGraphCircle(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m8.02,2.26v5.72l4.41,3.98c.83-1.02,1.32-2.33,1.32-3.74,0-3.22-2.55-5.83-5.73-5.96Z" />
          <path d="m7.77,3.5c-2.62,0-4.75,2.13-4.75,4.75s2.13,4.75,4.75,4.75c1.32,0,2.51-.55,3.37-1.42" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M13.1,15.09a.74.74,0,0,1-.5-.2l-6-5.48a.76.76,0,0,1-.24-.55V.76A.76.76,0,0,1,7.14,0a8.85,8.85,0,0,1,6.52,14.84A.76.76,0,0,1,13.1,15.09ZM7.89,8.53,13,13.25A7.34,7.34,0,0,0,7.89,1.55Z" />
          <path d="M7.14,16a7.13,7.13,0,0,1,0-14.26v1.5a5.63,5.63,0,1,0,4.15,9.44l1.1,1A7.12,7.12,0,0,1,7.14,16Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
