import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  direction?: 'up' | 'right' | 'down' | 'left';
}

export function IconPanel({direction = 'up', ...props}: Props) {
  const theme = useTheme();

  return (
    <SvgIcon
      {...props}
      kind={theme.isChonk ? 'stroke' : 'path'}
      style={{
        transform: direction
          ? `rotate(${theme.iconDirections[direction]}deg)`
          : undefined,
      }}
    >
      {theme.isChonk ? (
        <Fragment>
          <path d="M12.25 2.75L3.75 2.75C3.19772 2.75 2.75 3.19772 2.75 3.75L2.75 12.25C2.75 12.8023 3.19772 13.25 3.75 13.25L12.25 13.25C12.8023 13.25 13.25 12.8023 13.25 12.25L13.25 3.75C13.25 3.19771 12.8023 2.75 12.25 2.75Z" />
          <path d="M2.75 5.25L13.25 5.25" />
        </Fragment>
      ) : (
        <path d="M16,13.25V2.75C16,1.23,14.77,0,13.25,0H2.75C1.23,0,0,1.23,0,2.75V13.25c0,1.52,1.23,2.75,2.75,2.75H13.25c1.52,0,2.75-1.23,2.75-2.75ZM1.5,4.58v-1.83c0-.69,.56-1.25,1.25-1.25H13.25c.69,0,1.25,.56,1.25,1.25v1.83H1.5Zm1.25,9.92c-.69,0-1.25-.56-1.25-1.25V6.08H14.5v7.17c0,.69-.56,1.25-1.25,1.25H2.75Z" />
      )}
    </SvgIcon>
  );
}
