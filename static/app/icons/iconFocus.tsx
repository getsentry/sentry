import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  isFocused?: boolean;
}

function IconFocus({isFocused = true, ...props}: Props) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        isFocused ? (
          <Fragment>
            <path d="m3.25,6.25v-2c0-.55.45-1,1-1h2" />
            <path d="m9.75,3.25h2c.55,0,1,.45,1,1v2" />
            <path d="m12.75,9.75v2c0,.55-.45,1-1,1h-2" />
            <path d="m6.25,12.75h-2c-.55,0-1-.45-1-1v-2" />
            <circle cx="8" cy="8" r=".5" />
          </Fragment>
        ) : (
          <Fragment>
            <path d="M9.75,3.25h2c.55,0,1,.45,1,1v2" />
            <path d="M6.25,12.75h-2c-.55,0-1-.45-1-1v-2" />
            <line x1="2.81" y1="2.75" x2="13.31" y2="13.25" />
          </Fragment>
        )
      ) : isFocused ? (
        <Fragment>
          <path d="M8,15.97C3.6,15.97.03,12.4.03,8S3.6.03,8,.03s7.97,3.58,7.97,7.97-3.58,7.97-7.97,7.97ZM8,1.53c-3.57,0-6.47,2.9-6.47,6.47s2.9,6.47,6.47,6.47,6.47-2.9,6.47-6.47S11.57,1.53,8,1.53Z" />
          <path d="M8,12.36c-2.4,0-4.36-1.96-4.36-4.36s1.96-4.36,4.36-4.36,4.36,1.96,4.36,4.36-1.96,4.36-4.36,4.36ZM8,5.14c-1.58,0-2.86,1.28-2.86,2.86s1.28,2.86,2.86,2.86,2.86-1.28,2.86-2.86-1.28-2.86-2.86-2.86Z" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M8,15.97C3.6,15.97.03,12.4.03,8S3.6.03,8,.03s7.97,3.58,7.97,7.97-3.58,7.97-7.97,7.97ZM8,1.53c-3.57,0-6.47,2.9-6.47,6.47s2.9,6.47,6.47,6.47,6.47-2.9,6.47-6.47S11.57,1.53,8,1.53Z" />
          <path d="M8,12.36c-2.4,0-4.36-1.96-4.36-4.36s1.96-4.36,4.36-4.36,4.36,1.96,4.36,4.36-1.96,4.36-4.36,4.36ZM8,5.14c-1.58,0-2.86,1.28-2.86,2.86s1.28,2.86,2.86,2.86,2.86-1.28,2.86-2.86-1.28-2.86-2.86-2.86Z" />
          <path d="M15.26,15.97c-.19,0-.38-.07-.53-.22L.21,1.31c-.29-.29-.29-.77,0-1.06C.5-.04.97-.05,1.26.25l14.53,14.45c.29.29.29.77,0,1.06-.15.15-.34.22-.53.22Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}

IconFocus.displayName = 'IconFocus';

export {IconFocus};
