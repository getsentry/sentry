import * as React from 'react';
import {css} from '@emotion/core';

import theme from 'app/utils/theme';

import SvgIcon from './svgIcon';

type Props = React.ComponentProps<typeof SvgIcon> & {
  direction?: 'up' | 'right' | 'down' | 'left';
};

const IconArrow = React.forwardRef(function IconArrow(
  {direction = 'up', ...props}: Props,
  ref: React.Ref<SVGSVGElement>
) {
  return (
    <SvgIcon
      {...props}
      ref={ref}
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
      <path d="M13.76,7.32a.74.74,0,0,1-.53-.22L8,1.87,2.77,7.1A.75.75,0,1,1,1.71,6L7.47.28a.74.74,0,0,1,1.06,0L14.29,6a.75.75,0,0,1,0,1.06A.74.74,0,0,1,13.76,7.32Z" />
      <path d="M8,15.94a.75.75,0,0,1-.75-.75V.81a.75.75,0,0,1,1.5,0V15.19A.75.75,0,0,1,8,15.94Z" />
    </SvgIcon>
  );
});

IconArrow.displayName = 'IconArrow';

export {IconArrow};
