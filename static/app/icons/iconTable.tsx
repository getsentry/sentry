import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconTable(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M13.25 1C14.22 1 15 1.78 15 2.75V13.25C15 14.22 14.22 15 13.25 15H2.75C1.84 15 1.1 14.31 1.01 13.43L1 13.25V2.75C1 1.78 1.78 1 2.75 1H13.25ZM2.5 11V13.25L2.5 13.3C2.53 13.41 2.63 13.5 2.75 13.5H4.5V11H2.5ZM6 11V13.5H13.25C13.39 13.5 13.5 13.39 13.5 13.25V11H6ZM2.5 9.5H4.5V6.5H2.5V9.5ZM6 9.5H13.5V6.5H6V9.5ZM2.75 2.5C2.61 2.5 2.5 2.61 2.5 2.75V5H4.5V2.5H2.75ZM6 5H13.5V2.75C13.5 2.61 13.39 2.5 13.25 2.5H6V5Z" />
      ) : (
        <Fragment>
          <path d="M13.25,16H2.75c-1.52,0-2.75-1.23-2.75-2.75V2.75C0,1.23,1.23,0,2.75,0h10.5c1.52,0,2.75,1.23,2.75,2.75v10.5c0,1.52-1.23,2.75-2.75,2.75ZM2.75,1.5c-.69,0-1.25.56-1.25,1.25v10.5c0,.69.56,1.25,1.25,1.25h10.5c.69,0,1.25-.56,1.25-1.25V2.75c0-.69-.56-1.25-1.25-1.25H2.75Z" />
          <rect x=".75" y="5.08" width="14.5" height="1.5" />
          <rect x="9.67" y=".75" width="1.5" height="14.5" />
          <rect x=".75" y="8.16" width="14.5" height="1.5" />
          <rect x=".75" y="11.23" width="14.5" height="1.5" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
