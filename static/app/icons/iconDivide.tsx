import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconDivide(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon
      {...props}
      data-test-id="icon-divide"
      kind={theme.isChonk ? 'stroke' : 'path'}
    >
      {theme.isChonk ? (
        <Fragment>
          <line x1="2.75" y1="8" x2="13.25" y2="8" />
          <circle cx="8" cy="3.25" r=".5" />
          <circle cx="8" cy="12.75" r=".5" />
        </Fragment>
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
