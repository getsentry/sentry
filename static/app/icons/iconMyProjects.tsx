import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconMyProjects(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      <Fragment>
        <rect
          x="5.02"
          y="5"
          width="8.25"
          height="8.25"
          rx="1"
          ry="1"
          transform="translate(18.27 -.02) rotate(90)"
        />
        <path d="M2.77,9.5V3.75c0-.55.45-1,1-1h5.75" />
        <path d="M7.52,10.17c.78.78,2.34.78,3.25,0" />
        <circle cx="10.52" cy="7.75" r=".25" />
        <circle cx="7.77" cy="7.75" r=".25" />
      </Fragment>
    </SvgIcon>
  );
}

IconMyProjects.displayName = 'IconMyProjects';

export {IconMyProjects};
