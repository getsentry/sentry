import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconBitbucket(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M14.19 7.3L13.15 13.87C13.08 14.27 12.81 14.5 12.42 14.5H3.58C3.19 14.5 2.92 14.27 2.85 13.87L1.01 2.15C0.94 1.76 1.15 1.5 1.51 1.5H14.49C14.85 1.5 15.06 1.76 14.99 2.15L14.49 5.24C14.42 5.69 14.17 5.87 13.76 5.87H5.96C5.84 5.87 5.78 5.94 5.8 6.08L6.41 9.96C6.43 10.06 6.5 10.13 6.59 10.13H9.41C9.5 10.13 9.57 10.06 9.59 9.96L10.02 7.16C10.06 6.81 10.29 6.67 10.61 6.67H13.67C14.12 6.67 14.26 6.9 14.19 7.3Z" />
      ) : (
        <Fragment>
          <path d="M15.56.82H.52A.51.51,0,0,0,0,1.32.19.19,0,0,0,0,1.4L2.18,14.61a.7.7,0,0,0,.68.58H13.3a.52.52,0,0,0,.51-.43L16,1.41A.5.5,0,0,0,15.56.82ZM9.68,10.35H6.35l-.9-4.71h5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
