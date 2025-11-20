import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconReleases(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M11.25 0.5C11.94 0.5 12.5 1.06 12.5 1.75V3H12.75C13.44 3 14 3.56 14 4.25V6H14.75C15.44 6 16 6.56 16 7.25V13.75C16 14.44 15.44 15 14.75 15H1.25C0.56 15 0 14.44 0 13.75V7.25C0 6.56 0.56 6 1.25 6H2V4.25C2 3.56 2.56 3 3.25 3H3.5V1.75C3.5 1.06 4.06 0.5 4.75 0.5H11.25ZM1.5 13.5H14.5V7.5H1.5V13.5ZM3.5 6H12.5V4.5H3.5V6ZM5 3H11V2H5V3Z" />
      ) : (
        <Fragment>
          <path d="M14.77,16H1.23A1.26,1.26,0,0,1,0,14.75V6.52A1.25,1.25,0,0,1,1.23,5.27H14.77A1.25,1.25,0,0,1,16,6.52v8.23A1.26,1.26,0,0,1,14.77,16ZM1.48,14.5h13V6.77h-13Z" />
          <path d="M14.71,6h-1.5V4.14H2.79V6H1.29V3.89A1.25,1.25,0,0,1,2.54,2.64H13.46a1.25,1.25,0,0,1,1.25,1.25Z" />
          <path d="M13.37,3.39h-1.5V1.5H4.13V3.39H2.63V1.25A1.26,1.26,0,0,1,3.88,0h8.24a1.26,1.26,0,0,1,1.25,1.25Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
