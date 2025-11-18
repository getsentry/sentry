import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCommit(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M8 4C9.86384 4 11.43 5.27477 11.874 7H15.25C15.6642 7 16 7.33579 16 7.75C16 8.16421 15.6642 8.5 15.25 8.5H11.9678C11.7217 10.4731 10.0398 12 8 12C5.96025 12 4.27835 10.4731 4.03223 8.5H0.75C0.335786 8.5 0 8.16421 0 7.75C0 7.33579 0.335786 7 0.75 7H4.12598C4.57002 5.27477 6.13616 4 8 4ZM8 5.5C6.61929 5.5 5.5 6.61929 5.5 8C5.5 9.38071 6.61929 10.5 8 10.5C9.38071 10.5 10.5 9.38071 10.5 8C10.5 6.61929 9.38071 5.5 8 5.5Z" />
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
