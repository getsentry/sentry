import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconTag(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m13.21,9.67l-3.43,3.43c-.39.39-1.02.39-1.41,0l-4.98-4.98c-.2-.2-.3-.47-.29-.75l.14-3.13c.02-.5.41-.91.92-.95l3.31-.28c.29-.02.58.08.79.29l4.97,4.97c.39.39.39,1.02,0,1.41Z" />
          <circle cx="6.25" cy="6.25" r=".5" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M3.87,5.7A1.81,1.81,0,1,1,5.69,3.89,1.82,1.82,0,0,1,3.87,5.7Zm0-2.12a.31.31,0,1,0,.32.31A.31.31,0,0,0,3.87,3.58Z" />
          <path d="M8,16a.77.77,0,0,1-.53-.21L.24,8.53A.75.75,0,0,1,0,8V.79A.75.75,0,0,1,.77,0H8a.74.74,0,0,1,.53.21l7.22,7.22a.75.75,0,0,1,0,1.06L8.51,15.75A.74.74,0,0,1,8,16ZM1.52,7.69,8,14.15,14.14,8,7.67,1.54H1.52Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
