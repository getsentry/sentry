import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconTimer(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <polyline points="8 4.75 8 8 10 9.5" />
          <path d="m2.48,6.32c.71-2.23,2.79-3.84,5.26-3.84,3.05,0,5.52,2.47,5.52,5.52s-2.47,5.52-5.52,5.52c-1.99,0-3.74-1.06-4.71-2.64" />
          <polyline points="2.73 13.5 2.73 10.5 5.73 10.5" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M7.98,16c-3.33,0-6.35-2.11-7.5-5.24-.14-.39,.06-.82,.44-.96,.39-.14,.82,.06,.96,.44,.94,2.55,3.39,4.26,6.1,4.26,3.58,0,6.5-2.92,6.5-6.5S11.56,1.5,7.98,1.5C4.63,1.5,1.85,4,1.52,7.33c-.04,.41-.42,.72-.82,.67-.41-.04-.71-.41-.67-.82C.44,3.08,3.86,0,7.98,0c4.41,0,8,3.59,8,8s-3.59,8-8,8Z" />
          <path d="M1.18,15.25c-.41,0-.75-.34-.75-.75v-4c0-.2,.08-.39,.22-.53s.33-.22,.53-.22H5.18c.41,0,.75,.34,.75,.75s-.34,.75-.75,.75H1.93s0,3.25,0,3.25c0,.41-.34,.75-.75,.75Z" />
          <path d="M10.98,11.75c-.17,0-.34-.06-.48-.17l-3-2.5c-.17-.14-.27-.35-.27-.58V4c0-.41,.34-.75,.75-.75s.75,.34,.75,.75v4.15l2.73,2.27c.32,.27,.36,.74,.1,1.06-.15,.18-.36,.27-.58,.27Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}

IconTimer.displayName = 'IconTimer';

export {IconTimer};
