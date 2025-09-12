import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconFile(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m11.5,13.25h-7c-.55,0-1-.45-1-1V3.75c0-.55.45-1,1-1h2.56c.28,0,.55.12.74.33l4.44,4.89c.17.18.26.42.26.67v3.61c0,.55-.45,1-1,1Z" />
          <path d="m7.5,3.25v4.25c0,.55.45,1,1,1h3.75" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M13.34,16H2.67A1.75,1.75,0,0,1,.92,14.27V1.76A1.75,1.75,0,0,1,2.67,0H8.82a.75.75,0,0,1,.53.22l5.52,5.52a.75.75,0,0,1,.22.53v8A1.75,1.75,0,0,1,13.34,16ZM2.67,1.51a.25.25,0,0,0-.25.25V14.27a.25.25,0,0,0,.25.25H13.34a.25.25,0,0,0,.25-.25V6.59L8.51,1.51Z" />
          <path d="M14.34,7H9.82A1.75,1.75,0,0,1,8.07,5.28V.76a.75.75,0,1,1,1.5,0V5.28a.25.25,0,0,0,.25.25h4.52a.75.75,0,0,1,0,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
