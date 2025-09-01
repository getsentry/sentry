import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconSpan(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m5,6.25h5.5c.28,0,.5.22.5.5v3h-5.5c-.28,0-.5-.22-.5-.5v-3h0Z" />
          <path d="m3.25,2.75h5c.28,0,.5.22.5.5v3H3.25c-.28,0-.5-.22-.5-.5v-2.5c0-.28.22-.5.5-.5Z" />
          <path d="m7.25,9.75h5.5c.28,0,.5.22.5.5v2.5c0,.28-.22.5-.5.5h-5c-.28,0-.5-.22-.5-.5v-3h0Z" />
        </Fragment>
      ) : (
        <path d="M8.28,14.48h6.24V11.16H8.28ZM4.88,9.66h6.24V6.34H4.88Zm7.74,0h2.15A1.25,1.25,0,0,1,16,10.91v3.82A1.25,1.25,0,0,1,14.77,16H8a1.25,1.25,0,0,1-1.25-1.25V11.16H4.63A1.25,1.25,0,0,1,3.38,9.91V6.34H1.23A1.25,1.25,0,0,1,0,5.09V1.27A1.25,1.25,0,0,1,1.23,0H8A1.25,1.25,0,0,1,9.22,1.27V4.84h2.15a1.25,1.25,0,0,1,1.25,1.25ZM1.48,4.84H7.72V1.52H1.48Z" />
      )}
    </SvgIcon>
  );
}
