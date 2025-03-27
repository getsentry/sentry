import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

function IconSound({ref, ...props}: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} ref={ref} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m4.75,5.75h-1.5c-.55,0-1,.45-1,1v2.5c0,.55.45,1,1,1h1.5l2.91,3.45c.3.36.88.14.88-.32V2.62c0-.47-.58-.68-.88-.32l-2.91,3.45Z" />
          <path d="m12.52,4.5c1.96,1.96,1.98,5.11.05,7.05" />
          <path d="m10.79,6.5c.87.87.95,2.2.19,2.96" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M9.58,15.94a.71.71,0,0,1-.44-.15L3.58,11.73H.75A.75.75,0,0,1,0,11V5A.76.76,0,0,1,.75,4.2H3.58L9.14.14A.73.73,0,0,1,9.92.08a.75.75,0,0,1,.41.67V15.19a.73.73,0,0,1-.41.66A.69.69,0,0,1,9.58,15.94ZM1.5,10.23H3.83a.73.73,0,0,1,.44.15l4.56,3.33V2.22L4.27,5.56a.79.79,0,0,1-.44.14H1.5Z" />
          <path d="M13.92,11.79a.77.77,0,0,1-.53-.21.75.75,0,0,1,0-1.06,3.6,3.6,0,0,0,0-5.1.77.77,0,0,1,0-1.07.75.75,0,0,1,1.06,0,5.11,5.11,0,0,1,0,7.22A.75.75,0,0,1,13.92,11.79Z" />
          <path d="M11.76,10.35a.64.64,0,0,1-.33-.08.75.75,0,0,1-.34-1,.78.78,0,0,1,.14-.2,1.56,1.56,0,0,0,0-2.21A.75.75,0,0,1,12.29,5.8a3.07,3.07,0,0,1,0,4.32A.78.78,0,0,1,11.76,10.35Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}

IconSound.displayName = 'IconSound';

export {IconSound};
