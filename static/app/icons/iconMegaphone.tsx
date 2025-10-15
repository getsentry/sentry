import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconMegaphone(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m3.75,5.5h2.5v3.75h-2.5c-.55,0-1-.45-1-1v-1.75c0-.55.45-1,1-1Z" />
          <path
            d="m4.25,9.25h1.5c.28,0,.5.22.5.5v3.5h-2.5v-3.5c0-.28.22-.5.5-.5Z"
            transform="translate(10 22.5) rotate(180)"
          />
          <path d="m11.25,6h1.5c.55,0,1,.45,1,1v.75c0,.55-.45,1-1,1h-1.5v-2.75h0Z" />
          <path d="m10.48,12l-4.23-2.75v-3.75l4.23-2.75c.33-.22.77.02.77.42v8.41c0,.4-.44.64-.77.42Z" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M12.53,12H9.92a.8.8,0,0,1-.42-.13L6.44,9.76H.76A.75.75,0,0,1,0,9V3A.75.75,0,0,1,.76,2.2H6.44L9.5.13A.8.8,0,0,1,9.92,0h2.61a.76.76,0,0,1,.75.75V11.21A.76.76,0,0,1,12.53,12Zm-2.38-1.5h1.63v-9H10.15L7.09,3.57a.77.77,0,0,1-.42.13H1.51V8.26H6.67a.77.77,0,0,1,.42.13Z" />
          <path d="M12.53,9.44V7.94a2,2,0,1,0,0-3.92V2.52a3.46,3.46,0,1,1,0,6.92Z" />
          <path d="M5.28,16H1.64a.76.76,0,0,1-.75-.75V9h1.5v5.53H4.53V9H6v6.28A.76.76,0,0,1,5.28,16Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
