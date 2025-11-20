import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconGraphScatter(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M1.75 1C2.16 1 2.5 1.34 2.5 1.75V13.25C2.5 13.39 2.61 13.5 2.75 13.5L14.25 13.5C14.66 13.5 15 13.84 15 14.25C15 14.66 14.66 15 14.25 15L2.75 15C1.78 15 1 14.22 1 13.25V1.75C1 1.34 1.34 1 1.75 1ZM5 10C5.55 10 6 10.45 6 11C6 11.55 5.55 12 5 12C4.45 12 4 11.55 4 11C4 10.45 4.45 10 5 10ZM9 9C9.55 9 10 9.45 10 10C10 10.55 9.55 11 9 11C8.45 11 8 10.55 8 10C8 9.45 8.45 9 9 9ZM7 6C7.55 6 8 6.45 8 7C8 7.55 7.55 8 7 8C6.45 8 6 7.55 6 7C6 6.45 6.45 6 7 6ZM11 6C11.55 6 12 6.45 12 7C12 7.55 11.55 8 11 8C10.45 8 10 7.55 10 7C10 6.45 10.45 6 11 6ZM9 3C9.55 3 10 3.45 10 4C10 4.55 9.55 5 9 5C8.45 5 8 4.55 8 4C8 3.45 8.45 3 9 3ZM13 2C13.55 2 14 2.45 14 3C14 3.55 13.55 4 13 4C12.45 4 12 3.55 12 3C12 2.45 12.45 2 13 2Z" />
      ) : (
        <Fragment>
          <circle cx="1.31" cy="14.69" r="1.31" />
          <circle cx="14.69" cy="1.31" r="1.31" />
          <circle cx="7.86" cy="9.25" r="1.31" />
          <circle cx="8.75" cy="3.56" r="1.31" />
          <circle cx="1.85" cy="10.12" r="1.31" />
          <circle cx="8.14" cy="12.37" r="1.31" />
          <circle cx="12.61" cy="5.52" r="1.31" />
          <circle cx="4.92" cy="8.68" r="1.31" />
          <circle cx="12.11" cy="12.18" r="1.31" />
          <circle cx="12.11" cy="8.12" r="1.31" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
