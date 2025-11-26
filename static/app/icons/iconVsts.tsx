import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconVsts(props: SVGIconProps) {
  const theme = useTheme();

  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M16 12.69L11.91 16L5.7 13.7V16L2.27 11.42L12.57 12.23V3.43L16 2.9V12.69ZM12.57 3.43L2.27 5.54V11.42L0 10.43V5.85L1.54 3.81L6.84 2.3V0L12.57 3.43Z" />
      ) : (
        <Fragment>
          <polygon points="0 5.85 1.54 3.81 6.84 2.3 6.84 0 12.57 3.43 2.27 5.54 2.27 11.42 0 10.43 0 5.85" />
          <polygon points="12.57 3.43 12.57 12.23 2.27 11.42 5.7 16 5.7 13.7 11.91 16 16 12.69 16 2.9 12.57 3.43" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
