import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconPlay(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <path d="m13.18,7.68L4,2.38c-.33-.19-.75.05-.75.43v10.6c0,.38.42.63.75.43l9.18-5.3c.33-.19.33-.67,0-.87Z" />
      ) : (
        <path d="M2.17,15.48a.69.69,0,0,1-.37-.1.73.73,0,0,1-.38-.65V1.27A.73.73,0,0,1,1.8.62a.77.77,0,0,1,.75,0L14.2,7.35a.75.75,0,0,1,0,1.3L2.55,15.38A.75.75,0,0,1,2.17,15.48ZM2.92,2.57V13.43L12.33,8Z" />
      )}
    </SvgIcon>
  );
}
