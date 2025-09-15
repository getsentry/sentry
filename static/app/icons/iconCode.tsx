import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCode(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <line x1="8.92" y1="4.54" x2="7.08" y2="11.46" />
          <path d="m11.23,5.12l2.44,2.54c.19.19.19.5,0,.69l-2.44,2.54" />
          <path d="m4.77,10.88l-2.44-2.54c-.19-.19-.19-.5,0-.69l2.44-2.54" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M10.2,13.79c-.19,0-.38-.07-.53-.22-.29-.29-.29-.77,0-1.06l4.52-4.52-4.52-4.52c-.29-.29-.29-.77,0-1.06s.77-.29,1.06,0l5.05,5.05c.29.29.29.77,0,1.06l-5.05,5.05c-.15.15-.34.22-.53.22Z" />
          <path d="M5.8,13.8c-.19,0-.38-.07-.53-.22L.22,8.53c-.29-.29-.29-.77,0-1.06L5.27,2.42c.29-.29.77-.29,1.06,0s.29.77,0,1.06L1.81,8l4.52,4.52c.29.29.29.77,0,1.06-.15.15-.34.22-.53.22Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
