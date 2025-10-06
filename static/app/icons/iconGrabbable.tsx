import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconGrabbable(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <circle cx="5.5" cy="3.25" r=".5" />
          <circle cx="5.5" cy="8" r=".5" />
          <circle cx="5.5" cy="12.75" r=".5" />
          <circle cx="10.5" cy="3.25" r=".5" />
          <circle cx="10.5" cy="8" r=".5" />
          <circle cx="10.5" cy="12.75" r=".5" />
        </Fragment>
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
