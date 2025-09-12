import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export interface ArrowProps extends SVGIconProps {
  direction?: 'up' | 'right' | 'down' | 'left';
}

export function IconArrow({direction = 'up', ...props}: ArrowProps) {
  const theme = useTheme();

  return (
    <SvgIcon
      {...props}
      kind={theme.isChonk ? 'stroke' : 'path'}
      css={
        direction
          ? direction === 'down'
            ? // Down arrows have a zoom issue with Firefox inside of tables due to rotate.
              // Since arrows are symmetric, scaling to only flip vertically works to fix the issue.
              css`
                transform: scale(1, -1);
              `
            : css`
                transform: rotate(${theme.iconDirections[direction]}deg);
              `
          : undefined
      }
    >
      {theme.isChonk ? (
        <Fragment>
          <line x1="8" y1="14" x2="8" y2="2.25" />
          <path d="m2.75,6.84L7.29,2.29c.39-.39,1.02-.39,1.41,0l4.54,4.54" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M13.76,7.32a.74.74,0,0,1-.53-.22L8,1.87,2.77,7.1A.75.75,0,1,1,1.71,6L7.47.28a.74.74,0,0,1,1.06,0L14.29,6a.75.75,0,0,1,0,1.06A.74.74,0,0,1,13.76,7.32Z" />
          <path d="M8,15.94a.75.75,0,0,1-.75-.75V.81a.75.75,0,0,1,1.5,0V15.19A.75.75,0,0,1,8,15.94Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
