import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconVsts(props: SVGIconProps) {
  const theme = useTheme();

  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M16 12.6895L11.9102 16L5.7002 13.7002V16L2.27051 11.4199L12.5703 12.2295V3.42969L16 2.90039V12.6895ZM12.5703 3.42969L2.26953 5.54004V11.4199L0 10.4297V5.84961L1.54004 3.80957L6.83984 2.2998V0L12.5703 3.42969Z" />
      ) : (
        <Fragment>
          <polygon points="0 5.85 1.54 3.81 6.84 2.3 6.84 0 12.57 3.43 2.27 5.54 2.27 11.42 0 10.43 0 5.85" />
          <polygon points="12.57 3.43 12.57 12.23 2.27 11.42 5.7 16 5.7 13.7 11.91 16 16 12.69 16 2.9 12.57 3.43" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
