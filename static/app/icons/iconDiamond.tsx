import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

/**
 * @deprecated This icon will be removed in new UI.
 */
export function IconDiamond(props: SVGIconProps) {
  const theme = useTheme();

  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M7.40137 0.167969C7.69595 -0.0723403 8.13067 -0.0548771 8.40527 0.219727L15.5303 7.34473C15.8232 7.63762 15.8232 8.11238 15.5303 8.40527L8.40527 15.5303C8.11238 15.8232 7.63762 15.8232 7.34473 15.5303L0.219727 8.40527C-0.0731665 8.11238 -0.0731666 7.63762 0.219727 7.34473L7.34473 0.219727L7.40137 0.167969ZM1.81055 7.875L7.875 13.9395L13.9395 7.875L7.875 1.81055L1.81055 7.875Z" />
      ) : (
        <path d="M8,16a.74.74,0,0,1-.53-.22L.21,8.53a.75.75,0,0,1,0-1.06L7.47.21a.75.75,0,0,1,1.06,0l7.26,7.26a.75.75,0,0,1,0,1.06L8.53,15.79A.74.74,0,0,1,8,16Z" />
      )}
    </SvgIcon>
  );
}
