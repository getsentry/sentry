import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconFilter(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <line x1="2.75" y1="3.75" x2="13.25" y2="3.75" />
          <line x1="4.75" y1="8" x2="11.25" y2="8" />
          <line x1="6.75" y1="12.25" x2="9.25" y2="12.25" />
        </Fragment>
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
