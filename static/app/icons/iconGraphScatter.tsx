import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconGraphScatter(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m2.75,2.75v9.5c0,.55.45,1,1,1h9.5" />
          <circle cx="13" cy="3" r=".25" />
          <circle cx="9.5" cy="4.5" r=".25" />
          <circle cx="11.75" cy="6.5" r=".25" />
          <circle cx="9.25" cy="8.75" r=".25" />
          <circle cx="6.25" cy="6.25" r=".25" />
          <circle cx="6" cy="10" r=".25" />
        </Fragment>
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
