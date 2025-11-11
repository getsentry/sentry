import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconGrabbable(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind="path">
      {theme.isChonk ? (
        <path d="M6 11C6.55228 11 7 11.4477 7 12C7 12.5523 6.55228 13 6 13C5.44772 13 5 12.5523 5 12C5 11.4477 5.44772 11 6 11ZM10 11C10.5523 11 11 11.4477 11 12C11 12.5523 10.5523 13 10 13C9.44772 13 9 12.5523 9 12C9 11.4477 9.44772 11 10 11ZM6 7C6.55228 7 7 7.44772 7 8C7 8.55228 6.55228 9 6 9C5.44772 9 5 8.55228 5 8C5 7.44772 5.44772 7 6 7ZM10 7C10.5523 7 11 7.44772 11 8C11 8.55228 10.5523 9 10 9C9.44772 9 9 8.55228 9 8C9 7.44772 9.44772 7 10 7ZM6 3C6.55228 3 7 3.44772 7 4C7 4.55228 6.55228 5 6 5C5.44772 5 5 4.55228 5 4C5 3.44772 5.44772 3 6 3ZM10 3C10.5523 3 11 3.44772 11 4C11 4.55228 10.5523 5 10 5C9.44772 5 9 4.55228 9 4C9 3.44772 9.44772 3 10 3Z" />
      ) : (
        <Fragment>
          <circle cx="4.73" cy="8" r="1.31" />
          <circle cx="4.73" cy="1.31" r="1.31" />
          <circle cx="11.27" cy="8" r="1.31" />
          <circle cx="11.27" cy="1.31" r="1.31" />
          <circle cx="4.73" cy="14.69" r="1.31" />
          <circle cx="11.27" cy="14.69" r="1.31" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
