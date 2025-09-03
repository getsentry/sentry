import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconUser(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <rect x="5.97" y="2.75" width="4.05" height="5.5" rx="2" ry="2" />
          <path d="m12.25,13.25H3.75v-3c0-1.1.9-2,2-2h4.5c1.1,0,2,.9,2,2v3Z" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M8,10.63a4,4,0,0,1-3.94-4V4a3.94,3.94,0,1,1,7.88,0V6.68A4,4,0,0,1,8,10.63ZM8,1.52A2.44,2.44,0,0,0,5.56,4V6.68a2.44,2.44,0,1,0,4.88,0V4A2.44,2.44,0,0,0,8,1.52Z" />
          <path d="M14.19,16H1.81A1.74,1.74,0,0,1,.07,14.24V12.32A3.72,3.72,0,0,1,3.19,8.64l2.46-.41a.76.76,0,0,1,.87.62.75.75,0,0,1-.62.86l-2.47.41a2.22,2.22,0,0,0-1.86,2.2v1.92a.24.24,0,0,0,.24.24H14.19a.24.24,0,0,0,.24-.24V12.32a2.22,2.22,0,0,0-1.86-2.2L10.1,9.71a.75.75,0,0,1-.62-.86.76.76,0,0,1,.87-.62l2.47.41a3.72,3.72,0,0,1,3.11,3.68v1.92A1.74,1.74,0,0,1,14.19,16Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
