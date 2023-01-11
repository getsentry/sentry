import {forwardRef} from 'react';
import {useTheme} from '@emotion/react';

import {SvgIcon, SVGIconProps} from './svgIcon';

interface Props extends SVGIconProps {
  direction?: 'up' | 'right' | 'down' | 'left';
}

const IconPanel = forwardRef<SVGSVGElement, Props>(
  ({direction = 'up', ...props}, ref) => {
    const theme = useTheme();

    return (
      <SvgIcon
        {...props}
        ref={ref}
        style={{
          transform: direction
            ? `rotate(${theme.iconDirections[direction]}deg)`
            : undefined,
        }}
      >
        <path d="M16,13.25V2.75C16,1.23,14.77,0,13.25,0H2.75C1.23,0,0,1.23,0,2.75V13.25c0,1.52,1.23,2.75,2.75,2.75H13.25c1.52,0,2.75-1.23,2.75-2.75ZM1.5,4.58v-1.83c0-.69,.56-1.25,1.25-1.25H13.25c.69,0,1.25,.56,1.25,1.25v1.83H1.5Zm1.25,9.92c-.69,0-1.25-.56-1.25-1.25V6.08H14.5v7.17c0,.69-.56,1.25-1.25,1.25H2.75Z" />
      </SvgIcon>
    );
  }
);

IconPanel.displayName = 'IconPanel';

export {IconPanel};
