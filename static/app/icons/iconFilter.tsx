import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconFilter(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M10.25 12C10.66 12 11 12.34 11 12.75C11 13.16 10.66 13.5 10.25 13.5H5.75C5.34 13.5 5 13.16 5 12.75C5 12.34 5.34 12 5.75 12H10.25ZM12.25 7C12.66 7 13 7.34 13 7.75C13 8.16 12.66 8.5 12.25 8.5H3.75C3.34 8.5 3 8.16 3 7.75C3 7.34 3.34 7 3.75 7H12.25ZM14.25 2C14.66 2 15 2.34 15 2.75C15 3.16 14.66 3.5 14.25 3.5H1.75C1.34 3.5 1 3.16 1 2.75C1 2.34 1.34 2 1.75 2H14.25Z" />
      ) : (
        <Fragment>
          <path d="M15.1 3.7H.8C.3 3.7 0 3.4 0 3c0-.4.3-.8.8-.8h14.4c.4 0 .8.3.8.8s-.5.7-.9.7Z" />
          <path d="M11.6 13.8H4.3c-.4 0-.8-.3-.8-.8s.3-.8.8-.8h7.3c.4 0 .8.3.8.8s-.4.8-.8.8Z" />
          <path d="M13.4 8.7H2.5c-.4 0-.7-.3-.7-.7 0-.4.3-.8.8-.8h10.8c.4 0 .8.3.8.8-.1.4-.4.7-.8.7Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
