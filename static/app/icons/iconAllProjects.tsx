import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconAllProjects(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      <Fragment>
        <rect
          x="5"
          y="5"
          width="8.25"
          height="8.25"
          rx="1"
          ry="1"
          transform="translate(18.25 0) rotate(90)"
        />
        <path d="M2.75,9.5V3.75c0-.55.45-1,1-1h5.75" />
        <line x1="7.75" y1="7.75" x2="10.5" y2="7.75" />
        <line x1="7.75" y1="10.5" x2="10.5" y2="10.5" />
      </Fragment>
    </SvgIcon>
  );
}

IconAllProjects.displayName = 'IconAllProjects';

export {IconAllProjects};
