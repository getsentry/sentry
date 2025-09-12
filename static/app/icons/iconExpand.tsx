import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconExpand(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m3.25,6.25v-2c0-.55.45-1,1-1h2" />
          <path d="m9.75,3.25h2c.55,0,1,.45,1,1v2" />
          <path d="m12.75,9.75v2c0,.55-.45,1-1,1h-2" />
          <path d="m6.25,12.75h-2c-.55,0-1-.45-1-1v-2" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M15.26,5.74c-.41,0-.75-.34-.75-.75V1.5h-3.49c-.41,0-.75-.34-.75-.75s.34-.75,.75-.75h4.24c.41,0,.75,.34,.75,.75V4.99c0,.41-.34,.75-.75,.75Z" />
          <path d="M.78,5.74C.36,5.74,.03,5.4,.03,4.99V.75C.03,.34,.36,0,.78,0H4.99c.41,0,.75,.34,.75,.75s-.34,.75-.75,.75H1.53v3.49c0,.41-.34,.75-.75,.75Z" />
          <path d="M15.23,16h-4.22c-.41,0-.75-.34-.75-.75s.34-.75,.75-.75h3.47v-3.47c0-.41,.34-.75,.75-.75s.75,.34,.75,.75v4.22c0,.41-.34,.75-.75,.75Z" />
          <path d="M4.97,16H.76C.34,16,0,15.66,0,15.25v-4.22c0-.41,.34-.75,.75-.75s.75,.34,.75,.75v3.47h3.47c.41,0,.75,.34,.75,.75s-.34,.75-.75,.75Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
