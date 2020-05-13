import React from 'react';
import {css} from '@emotion/core';

import theme from 'app/utils/theme';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon> & {
  direction?: 'up' | 'right' | 'down' | 'left';
};

const IconArrow = React.forwardRef<SVGSVGElement, Props>(
  ({direction = 'up', ...props}: Props, ref) => (
    <SvgIcon
      {...props}
      ref={ref}
      css={
        direction
          ? css`
              transform: rotate(${theme.iconDirections[direction]}deg);
            `
          : undefined
      }
    >
      <path d="M13.76,7.32a.74.74,0,0,1-.53-.22L8,1.87,2.77,7.1A.75.75,0,1,1,1.71,6L7.47.28a.74.74,0,0,1,1.06,0L14.29,6a.75.75,0,0,1,0,1.06A.74.74,0,0,1,13.76,7.32Z" />
      <path d="M8,15.94a.75.75,0,0,1-.75-.75V.81a.75.75,0,0,1,1.5,0V15.19A.75.75,0,0,1,8,15.94Z" />
    </SvgIcon>
  )
);

export {IconArrow};
