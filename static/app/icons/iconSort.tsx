import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  rotated?: boolean;
}

export function IconSort({rotated, ...props}: Props) {
  const theme = useTheme();
  return (
    <SvgIcon
      {...props}
      kind={theme.isChonk ? 'stroke' : 'path'}
      css={
        rotated &&
        css`
          transform: rotate(90deg);
        `
      }
    >
      {theme.isChonk ? (
        <Fragment>
          <line x1="11" y1="3.75" x2="11" y2="13.25" />
          <polyline points="13.25 11 11 13.25 8.75 11" />
          <line x1="5" y1="12.25" x2="5" y2="2.75" />
          <polyline points="2.75 5 5 2.75 7.25 5" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M15.49 11.76a.75.75 0 0 1-.22.53l-2.88 2.88a.75.75 0 0 1-1.06 0l-2.87-2.88a.74.74 0 0 1 0-1.06.75.75 0 0 1 1.06 0l2.34 2.35 2.35-2.35a.75.75 0 0 1 1.06 0 .79.79 0 0 1 .22.53Z" />
          <path d="M12.61 1.34v13.3a.75.75 0 1 1-1.5 0V1.34a.75.75 0 1 1 1.5 0Z" />
          <path d="M7.87 4.22a.74.74 0 0 1-.22.53.75.75 0 0 1-1.06 0L4.25 2.4 1.9 4.75A.75.75 0 0 1 .84 3.69L3.72.81a.75.75 0 0 1 1.06 0l2.87 2.88a.74.74 0 0 1 .22.53Z" />
          <path d="M5 1.34v13.3a.75.75 0 1 1-1.5 0V1.34a.75.75 0 0 1 1.5 0Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
