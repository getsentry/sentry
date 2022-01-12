import * as React from 'react';
import {css} from '@emotion/react';

import theme from 'sentry/utils/theme';

import SvgIcon, {SVGIconProps} from './svgIcon';

interface Props extends SVGIconProps {
  direction?: 'up' | 'right' | 'down' | 'left';
}

const IconChevron = React.forwardRef<SVGSVGElement, Props>(
  ({isCircled = false, direction = 'up', ...props}, ref) => {
    return (
      <SvgIcon
        {...props}
        isCircled={isCircled}
        ref={ref}
        css={
          direction
            ? css`
                transition: transform 120ms ease-in-out;
                transform: rotate(${theme.iconDirections[direction]}deg);
              `
            : undefined
        }
      >
        {isCircled ? (
          <path d="M11.12,9.87a.73.73,0,0,1-.53-.22L8,7.07,5.41,9.65a.74.74,0,0,1-1.06,0,.75.75,0,0,1,0-1.06L7.47,5.48a.74.74,0,0,1,1.06,0l3.12,3.11a.75.75,0,0,1,0,1.06A.74.74,0,0,1,11.12,9.87Z" />
        ) : (
          <path d="M14,11.75a.74.74,0,0,1-.53-.22L8,6.06,2.53,11.53a.75.75,0,0,1-1.06-1.06l6-6a.75.75,0,0,1,1.06,0l6,6a.75.75,0,0,1,0,1.06A.74.74,0,0,1,14,11.75Z" />
        )}
      </SvgIcon>
    );
  }
);

IconChevron.displayName = 'IconChevron';

export {IconChevron};
