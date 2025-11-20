import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconMail(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M14.25 2C15.22 2 16 2.78 16 3.75V12.25C16 13.22 15.22 14 14.25 14H1.75C0.78 14 0 13.22 0 12.25V3.75C0 2.78 0.78 2 1.75 2H14.25ZM8.88 10.18C8.4 10.66 7.6 10.66 7.12 10.18L6 9.06L2.56 12.5H13.44L10 9.06L8.88 10.18ZM1.5 11.44L4.94 8L1.5 4.56V11.44ZM11.06 8L14.5 11.44V4.56L11.06 8ZM8 8.94L13.44 3.5H2.56L8 8.94Z" />
      ) : (
        <Fragment>
          <path d="M15.25,14.09H.75A.76.76,0,0,1,0,13.34V2.66a.76.76,0,0,1,.75-.75h14.5a.76.76,0,0,1,.75.75V13.34A.76.76,0,0,1,15.25,14.09ZM1.5,12.59h13V3.41H1.5Z" />
          <path d="M8,9.92a.78.78,0,0,1-.5-.19L.25,3.22a.75.75,0,1,1,1-1.12L8,8.16,14.75,2.1a.75.75,0,1,1,1,1.12L8.5,9.73A.78.78,0,0,1,8,9.92Z" />
          <rect
            x="-0.27"
            y="9.92"
            width="7.99"
            height="1.5"
            transform="translate(-6.17 5.21) rotate(-41.89)"
          />
          <rect
            x="11.52"
            y="6.67"
            width="1.5"
            height="7.99"
            transform="translate(-3.86 12.68) rotate(-48.09)"
          />
        </Fragment>
      )}
    </SvgIcon>
  );
}
