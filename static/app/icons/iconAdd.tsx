import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface IconAddProps extends SVGIconProps {
  /**
   * @deprecated circled variant will be removed.
   */
  isCircled?: boolean;
}

export function IconAdd({isCircled = false, ...props}: IconAddProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} data-test-id="icon-add">
      {theme.isChonk ? (
        <path d="M8 1C8.41421 1 8.75 1.33579 8.75 1.75V7.25H14.25C14.6642 7.25 15 7.58579 15 8C15 8.41421 14.6642 8.75 14.25 8.75H8.75V14.25C8.75 14.6642 8.41421 15 8 15C7.58579 15 7.25 14.6642 7.25 14.25V8.75H1.75C1.33579 8.75 1 8.41421 1 8C1 7.58579 1.33579 7.25 1.75 7.25H7.25V1.75C7.25 1.33579 7.58579 1 8 1Z" />
      ) : isCircled ? (
        <Fragment>
          <path d="M11.28,8.75H4.72a.75.75,0,1,1,0-1.5h6.56a.75.75,0,1,1,0,1.5Z" />
          <path d="M8,12a.76.76,0,0,1-.75-.75V4.72a.75.75,0,0,1,1.5,0v6.56A.76.76,0,0,1,8,12Z" />
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M8.75,7.25V2a.75.75,0,0,0-1.5,0V7.25H2a.75.75,0,0,0,0,1.5H7.25V14a.75.75,0,0,0,1.5,0V8.75H14a.75.75,0,0,0,0-1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
