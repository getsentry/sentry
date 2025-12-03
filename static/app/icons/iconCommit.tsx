import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCommit(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M8 4C9.86 4 11.43 5.27 11.87 7H15.25C15.66 7 16 7.34 16 7.75C16 8.16 15.66 8.5 15.25 8.5H11.97C11.72 10.47 10.04 12 8 12C5.96 12 4.28 10.47 4.03 8.5H0.75C0.34 8.5 0 8.16 0 7.75C0 7.34 0.34 7 0.75 7H4.13C4.57 5.27 6.14 4 8 4ZM8 5.5C6.62 5.5 5.5 6.62 5.5 8C5.5 9.38 6.62 10.5 8 10.5C9.38 10.5 10.5 9.38 10.5 8C10.5 6.62 9.38 5.5 8 5.5Z" />
      ) : (
        <Fragment>
          <path d="M8,11.91A3.91,3.91,0,1,1,11.91,8,3.91,3.91,0,0,1,8,11.91ZM8,5.59A2.41,2.41,0,1,0,10.41,8,2.41,2.41,0,0,0,8,5.59Z" />
          <path d="M15.23,8.75H11.16a.75.75,0,0,1,0-1.5h4.07a.75.75,0,0,1,0,1.5Z" />
          <path d="M4.84,8.75H.77a.75.75,0,1,1,0-1.5H4.84a.75.75,0,0,1,0,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
