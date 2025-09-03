import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  direction?: 'up' | 'right' | 'down' | 'left';
}

export function IconSliders({direction = 'up', ...props}: Props) {
  const theme = useTheme();

  return (
    <SvgIcon
      {...props}
      kind={theme.isChonk ? 'stroke' : 'path'}
      css={
        direction
          ? css`
              transform: rotate(${theme.iconDirections[direction]}deg);
            `
          : undefined
      }
    >
      {theme.isChonk ? (
        <Fragment>
          <circle cx="5.25" cy="6" r="1.75" />
          <line x1="5.25" y1="2.75" x2="5.25" y2="4.25" />
          <line x1="5.25" y1="13.25" x2="5.25" y2="7.75" />
          <circle cx="10.75" cy="10" r="1.75" />
          <line x1="10.75" y1="13.25" x2="10.75" y2="11.75" />
          <line x1="10.75" y1="2.75" x2="10.75" y2="8.25" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M4.33,14a2.86,2.86,0,1,1,2.86-2.85A2.86,2.86,0,0,1,4.33,14Zm0-4.21a1.36,1.36,0,1,0,1.36,1.36A1.35,1.35,0,0,0,4.33,9.75Z" />
          <path d="M11.71,7.75a2.86,2.86,0,1,1,2.85-2.86A2.86,2.86,0,0,1,11.71,7.75Zm0-4.21a1.36,1.36,0,1,0,1.35,1.35A1.36,1.36,0,0,0,11.71,3.54Z" />
          <path d="M15.19,11.86H6.44a.75.75,0,0,1,0-1.5h8.75a.75.75,0,0,1,0,1.5Z" />
          <path d="M2.23,11.86H.81a.75.75,0,0,1,0-1.5H2.23a.75.75,0,1,1,0,1.5Z" />
          <path d="M15.19,5.64H13.81a.75.75,0,0,1,0-1.5h1.38a.75.75,0,0,1,0,1.5Z" />
          <path d="M9.6,5.64H.81a.75.75,0,1,1,0-1.5H9.6a.75.75,0,0,1,0,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
