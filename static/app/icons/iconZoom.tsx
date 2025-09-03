import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  isZoomIn?: boolean;
}

export function IconZoom({isZoomIn = false, ...props}: Props) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        isZoomIn ? (
          <Fragment>
            <line x1="8.5" y1="7" x2="5.5" y2="7" />
            <circle cx="7" cy="7" r="4.25" />
            <line x1="13.25" y1="13.25" x2="10" y2="10" />
            <line x1="7" y1="8.5" x2="7" y2="5.5" />
          </Fragment>
        ) : (
          <Fragment>
            <line x1="8.5" y1="7" x2="5.5" y2="7" />
            <circle cx="7" cy="7" r="4.25" />
            <line x1="13.25" y1="13.25" x2="10" y2="10" />
          </Fragment>
        )
      ) : isZoomIn ? (
        <Fragment>
          <path d="m6,11.95C2.72,11.95.05,9.28.05,6S2.72.05,6,.05s5.95,2.67,5.95,5.95-2.67,5.95-5.95,5.95Zm0-10.41C3.54,1.55,1.55,3.54,1.55,6s2,4.45,4.45,4.45,4.45-2,4.45-4.45S8.45,1.55,6,1.55Z" />
          <path d="m15.2,15.95c-.19,0-.38-.07-.53-.22l-5.53-5.53c-.29-.29-.29-.77,0-1.06s.77-.29,1.06,0l5.53,5.53c.29.29.29.77,0,1.06-.15.15-.34.22-.53.22Z" />
          <path d="m8.81,6.75H3.19c-.41,0-.75-.34-.75-.75s.34-.75.75-.75h5.62c.41,0,.75.34.75.75s-.34.75-.75.75Z" />
          <path d="m6,9.56c-.41,0-.75-.34-.75-.75V3.19c0-.41.34-.75.75-.75s.75.34.75.75v5.62c0,.41-.34.75-.75.75Z" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="m6,11.95C2.72,11.95.05,9.28.05,6S2.72.05,6,.05s5.95,2.67,5.95,5.95-2.67,5.95-5.95,5.95Zm0-10.41C3.54,1.55,1.55,3.54,1.55,6s2,4.45,4.45,4.45,4.45-2,4.45-4.45S8.45,1.55,6,1.55Z" />
          <path d="m15.2,15.95c-.19,0-.38-.07-.53-.22l-5.53-5.53c-.29-.29-.29-.77,0-1.06s.77-.29,1.06,0l5.53,5.53c.29.29.29.77,0,1.06-.15.15-.34.22-.53.22Z" />
          <path d="m8.81,6.75H3.19c-.41,0-.75-.34-.75-.75s.34-.75.75-.75h5.62c.41,0,.75.34.75.75s-.34.75-.75.75Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
