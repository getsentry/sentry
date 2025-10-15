import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconGraphBar(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m2.75,2.75v9.5c0,.55.45,1,1,1h9.5" />
          <line x1="5.42" y1="10.75" x2="5.42" y2="8.75" />
          <line x1="8" y1="10.75" x2="8" y2="5.5" />
          <line x1="10.58" y1="10.75" x2="10.58" y2="6.75" />
          <line x1="13.17" y1="10.75" x2="13.17" y2="2.75" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M6.63,15.99H.74c-.41,0-.75-.34-.75-.75V6.71c0-.41.34-.75.75-.75h5.9c.41,0,.75.34.75.75v8.53c0,.41-.34.75-.75.75ZM1.49,14.49h4.4v-7.03H1.49v7.03Z" />
          <path d="M15.25,15.99h-5.67c-.41,0-.75-.34-.75-.75V.76c0-.41.34-.75.75-.75h5.67c.41,0,.75.34.75.75v14.48c0,.41-.34.75-.75.75ZM10.33,14.49h4.17V1.51h-4.17v12.98Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
