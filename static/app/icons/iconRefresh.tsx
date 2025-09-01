import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconRefresh(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path
            className="cls-1"
            d="m13.25,9.68c-.71,2.23-2.79,3.84-5.26,3.84-3.05,0-5.52-2.47-5.52-5.52S4.95,2.48,7.99,2.48c1.99,0,3.74,1.06,4.71,2.64"
          />
          <polyline className="cls-1" points="13 2.5 13 5.5 10 5.5" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="m9.66,4.87c0,.41.34.75.75.75h4.01c.41,0,.75-.34.75-.75V.85c0-.41-.34-.75-.75-.75s-.75.34-.75.75v3.26h-3.26c-.41,0-.75.34-.75.75Z" />
          <path d="m.11,8c0,4.35,3.54,7.9,7.9,7.9s7.9-3.54,7.9-7.9c0-.41-.34-.75-.75-.75s-.75.34-.75.75c0,3.53-2.87,6.4-6.4,6.4S1.61,11.53,1.61,8,4.48,1.6,8.01,1.6c2.46,0,4.66,1.37,5.75,3.59.18.37.63.53,1,.34.37-.18.53-.63.34-1C13.76,1.8,11.04.1,8.01.1c-4.35,0-7.9,3.54-7.9,7.9Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
