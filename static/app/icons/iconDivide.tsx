import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconDivide(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} data-test-id="icon-divide">
      {theme.isChonk ? (
        <path d="M8 12C8.55228 12 9 12.4477 9 13C9 13.5523 8.55228 14 8 14C7.44772 14 7 13.5523 7 13C7 12.4477 7.44772 12 8 12ZM14.25 7.25C14.6642 7.25 15 7.58579 15 8C15 8.41421 14.6642 8.75 14.25 8.75H1.75C1.33579 8.75 1 8.41421 1 8C1 7.58579 1.33579 7.25 1.75 7.25H14.25ZM8 2C8.55228 2 9 2.44772 9 3C9 3.55228 8.55228 4 8 4C7.44772 4 7 3.55228 7 3C7 2.44772 7.44772 2 8 2Z" />
      ) : (
        <Fragment>
          <path d="M14,8.75H2c-.41,0-.75-.34-.75-.75s.34-.75.75-.75h12c.41,0,.75.34.75.75s-.34.75-.75.75Z" />
          <circle cx="7.95" cy="2.42" r="1.31" />
          <circle cx="7.95" cy="13.56" r="1.31" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
