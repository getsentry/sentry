import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconFile(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M7.34 0C7.97 0 8.57 0.27 9 0.73L13.41 5.56C13.79 5.98 14 6.52 14 7.08V14C14 14.55 13.55 15 13 15H3C2.45 15 2 14.55 2 14V1.75C2 0.78 2.78 0 3.75 0H7.34ZM3.75 1.5C3.61 1.5 3.5 1.61 3.5 1.75V13.5H12.5V8H8C7.45 8 7 7.55 7 7V1.5H3.75ZM8.5 6.5H12.23L8.5 2.41V6.5Z" />
      ) : (
        <Fragment>
          <path d="M13.34,16H2.67A1.75,1.75,0,0,1,.92,14.27V1.76A1.75,1.75,0,0,1,2.67,0H8.82a.75.75,0,0,1,.53.22l5.52,5.52a.75.75,0,0,1,.22.53v8A1.75,1.75,0,0,1,13.34,16ZM2.67,1.51a.25.25,0,0,0-.25.25V14.27a.25.25,0,0,0,.25.25H13.34a.25.25,0,0,0,.25-.25V6.59L8.51,1.51Z" />
          <path d="M14.34,7H9.82A1.75,1.75,0,0,1,8.07,5.28V.76a.75.75,0,1,1,1.5,0V5.28a.25.25,0,0,0,.25.25h4.52a.75.75,0,0,1,0,1.5Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
