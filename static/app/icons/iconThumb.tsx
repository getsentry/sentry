import {forwardRef} from 'react';
import {css, useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  direction?: 'up' | 'right' | 'down' | 'left';
}

const IconThumb = forwardRef<SVGSVGElement, Props>(
  ({direction = 'up', ...props}, ref) => {
    const theme = useTheme();

    return (
      <SvgIcon
        {...props}
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
        <path d="M12.57,16.01h-5.27c-.7,0-1.41-.09-2.09-.25l-1.91-.47H.74c-.41,0-.75-.34-.75-.75v-7.96c0-.41.34-.75.75-.75h3.15c.61,0,1.13-.44,1.23-1.04l.51-2.93c.1-.59.43-1.11.93-1.45.49-.34,1.09-.47,1.68-.37.59.1,1.11.43,1.45.92.34.49.48,1.09.37,1.68l-.51,2.89h4.19c1.24,0,2.25,1.01,2.25,2.25,0,.68-.31,1.29-.79,1.71.26.37.41.81.41,1.29,0,.8-.42,1.51-1.06,1.91.18.32.28.69.28,1.09,0,1.24-1.01,2.25-2.25,2.25ZM1.49,13.79h1.91c.06,0,.12,0,.18.02l1.99.49c.57.14,1.15.21,1.73.21h5.27c.41,0,.75-.33.75-.75s-.33-.75-.75-.75-.75-.34-.75-.75.34-.75.75-.75h.78c.41,0,.75-.33.75-.75s-.33-.75-.75-.75-.75-.34-.75-.75.34-.75.75-.75h.38c.41,0,.75-.33.75-.75s-.33-.75-.75-.75h-5.09c-.22,0-.43-.1-.58-.27s-.2-.39-.16-.61l.67-3.77c.03-.2,0-.39-.12-.56-.11-.16-.29-.27-.48-.31-.2-.03-.39,0-.56.12-.16.11-.27.29-.31.48l-.51,2.93c-.23,1.32-1.37,2.28-2.71,2.28H1.49v6.46Z" />
        <path d="M3.4,15.29c-.41,0-.75-.34-.75-.75v-7.96c0-.41.34-.75.75-.75s.75.34.75.75v7.96c0,.41-.34.75-.75.75Z" />
      </SvgIcon>
    );
  }
);

IconThumb.displayName = 'IconThumb';

export {IconThumb};
