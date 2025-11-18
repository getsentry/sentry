import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconInfo(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C1.77176e-07 3.58172 3.58172 1.7717e-07 8 0ZM8 1.5C4.41015 1.5 1.5 4.41015 1.5 8C1.5 11.5899 4.41015 14.5 8 14.5C11.5899 14.5 14.5 11.5899 14.5 8C14.5 4.41015 11.5899 1.5 8 1.5ZM8 7C8.41421 7 8.75 7.33579 8.75 7.75V11.25C8.75 11.6642 8.41421 12 8 12C7.58579 12 7.25 11.6642 7.25 11.25V7.75C7.25 7.33579 7.58579 7 8 7ZM8 4C8.55228 4 9 4.44772 9 5C9 5.55228 8.55228 6 8 6C7.44772 6 7 5.55228 7 5C7 4.44772 7.44772 4 8 4Z" />
      ) : (
        <Fragment>
          <path d="M8,11.78A.74.74,0,0,1,7.24,11V7a.75.75,0,0,1,1.5,0v4A.75.75,0,0,1,8,11.78Z" />
          <circle cx="8" cy="4.78" r="0.76" />
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
