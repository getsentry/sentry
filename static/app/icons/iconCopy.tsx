import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconCopy(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <rect
            x="5.75"
            y="2.75"
            width="7.5"
            height="7.5"
            rx="1"
            ry="1"
            transform="translate(16 -3) rotate(90)"
          />
          <path d="m5.75,5.75h-2c-.55,0-1,.45-1,1v5.5c0,.55.45,1,1,1h5.5c.55,0,1-.45,1-1v-2" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M14.24,12.49H5.58a1.75,1.75,0,0,1-1.75-1.75v-9A1.75,1.75,0,0,1,5.58,0h8.66A1.75,1.75,0,0,1,16,1.74v9A1.75,1.75,0,0,1,14.24,12.49Zm-8.66-11a.25.25,0,0,0-.25.25v9a.25.25,0,0,0,.25.25h8.66a.25.25,0,0,0,.25-.25v-9a.25.25,0,0,0-.25-.25Z" />
          <path d="M10.38,16H1.72A1.75,1.75,0,0,1,0,14.26v-9A1.75,1.75,0,0,1,1.72,3.51H4.58a.75.75,0,0,1,0,1.5H1.72a.25.25,0,0,0-.25.25v9a.25.25,0,0,0,.25.25h8.66a.25.25,0,0,0,.25-.25V11.74a.75.75,0,0,1,1.5,0v2.52A1.75,1.75,0,0,1,10.38,16Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
