import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconProfiling(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path className="cls-1" d="m2.75,6.25h8v3c0,.28-.22.5-.5.5H2.75v-3.5h0Z" />
          <path
            className="cls-1"
            d="m3.25,2.75h9.5c.28,0,.5.22.5.5v2.5c0,.28-.22.5-.5.5H2.75v-3c0-.28.22-.5.5-.5Z"
          />
          <path
            className="cls-1"
            d="m2.75,9.75h4.5v3c0,.28-.22.5-.5.5h-3.5c-.28,0-.5-.22-.5-.5v-3h0Z"
          />
        </Fragment>
      ) : (
        <path d="M15.25,0H.75C.33,0,0,.34,0,.75V5.59c0,.41,.34,.75,.75,.75h1.49v4.09c0,.41,.34,.75,.75,.75h1.73v4.09c0,.41,.34,.75,.75,.75h5.06c.41,0,.75-.34,.75-.75v-4.09h1.73c.41,0,.75-.34,.75-.75V6.34h1.49c.41,0,.75-.34,.75-.75V.75c0-.41-.34-.75-.75-.75Zm-5.47,14.52h-3.56v-3.34h3.56v3.34Zm2.48-4.84H3.74v-3.34H12.25v3.34Zm2.24-4.84H1.5V1.5H14.5v3.34Z" />
      )}
    </SvgIcon>
  );
}
