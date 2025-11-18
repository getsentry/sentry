import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconMail(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M14.25 2C15.2165 2 16 2.7835 16 3.75V12.25C16 13.2165 15.2165 14 14.25 14H1.75C0.783501 14 1.00665e-08 13.2165 0 12.25V3.75C0 2.7835 0.783502 2 1.75 2H14.25ZM8.88379 10.1768C8.39564 10.6649 7.60436 10.6649 7.11621 10.1768L6 9.06055L2.56055 12.5H13.4395L10 9.06055L8.88379 10.1768ZM1.5 11.4395L4.93945 8L1.5 4.56055V11.4395ZM11.0605 8L14.5 11.4395V4.56055L11.0605 8ZM8 8.93945L13.4395 3.5H2.56055L8 8.93945Z" />
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
