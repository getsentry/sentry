import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconGrabbable(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M6 12C6.55228 12 7 12.4477 7 13C7 13.5523 6.55228 14 6 14C5.44772 14 5 13.5523 5 13C5 12.4477 5.44772 12 6 12ZM10 12C10.5523 12 11 12.4477 11 13C11 13.5523 10.5523 14 10 14C9.44772 14 9 13.5523 9 13C9 12.4477 9.44772 12 10 12ZM6 7C6.55228 7 7 7.44772 7 8C7 8.55228 6.55228 9 6 9C5.44772 9 5 8.55228 5 8C5 7.44772 5.44772 7 6 7ZM10 7C10.5523 7 11 7.44772 11 8C11 8.55228 10.5523 9 10 9C9.44772 9 9 8.55228 9 8C9 7.44772 9.44772 7 10 7ZM6 2C6.55228 2 7 2.44772 7 3C7 3.55228 6.55228 4 6 4C5.44772 4 5 3.55228 5 3C5 2.44772 5.44772 2 6 2ZM10 2C10.5523 2 11 2.44772 11 3C11 3.55228 10.5523 4 10 4C9.44772 4 9 3.55228 9 3C9 2.44772 9.44772 2 10 2Z" />
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
