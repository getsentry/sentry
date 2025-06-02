import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconProject(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path
            className="cls-1"
            d="m12.25,13.25H3.75c-.55,0-1-.45-1-1V3.75c0-.55.45-1,1-1h2.88c.38,0,.73.21.89.55l.45.89c.17.34.52.55.89.55h3.38c.55,0,1,.45,1,1v6.5c0,.55-.45,1-1,1Z"
          />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M5.43,11.92a.73.73,0,0,1-.53-.22L3,9.82A.75.75,0,0,1,3,8.76L4.9,6.88A.75.75,0,0,1,6,7.94L4.61,9.29,6,10.64A.75.75,0,0,1,6,11.7.74.74,0,0,1,5.43,11.92Z" />
          <path d="M10.58,11.92a.74.74,0,0,1-.53-.22.75.75,0,0,1,0-1.06L11.4,9.29,10.05,7.94a.75.75,0,0,1,1.06-1.06L13,8.76a.74.74,0,0,1,0,1.06L11.11,11.7A.71.71,0,0,1,10.58,11.92Z" />
          <path d="M15.26,16H.76A.75.75,0,0,1,0,15.26V.76A.74.74,0,0,1,.76,0H5.12A2.75,2.75,0,0,1,6.77.56L8.51,1.87a1.3,1.3,0,0,0,.75.25h6a.76.76,0,0,1,.75.75V15.26A.76.76,0,0,1,15.26,16ZM1.51,14.51h13V3.62H9.26a2.75,2.75,0,0,1-1.65-.55L5.87,1.76h0a1.3,1.3,0,0,0-.75-.25H1.51Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}

IconProject.displayName = 'IconProject';

export {IconProject};
