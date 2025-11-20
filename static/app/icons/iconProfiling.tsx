import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconProfiling(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M12.75 0C13.44 0 14 0.56 14 1.25V4.75C14 5.44 13.44 6 12.75 6H11V9.25C11 9.94 10.44 10.5 9.75 10.5H8.5V13.75C8.5 14.44 7.94 15 7.25 15H3.25C2.56 15 2 14.44 2 13.75V1.25C2 0.56 2.56 0 3.25 0H12.75ZM3.5 13.5H7V10.5H3.5V13.5ZM3.5 9H9.5V6H3.5V9ZM3.5 4.5H12.5V1.5H3.5V4.5Z" />
      ) : (
        <path d="M15.25,0H.75C.33,0,0,.34,0,.75V5.59c0,.41,.34,.75,.75,.75h1.49v4.09c0,.41,.34,.75,.75,.75h1.73v4.09c0,.41,.34,.75,.75,.75h5.06c.41,0,.75-.34,.75-.75v-4.09h1.73c.41,0,.75-.34,.75-.75V6.34h1.49c.41,0,.75-.34,.75-.75V.75c0-.41-.34-.75-.75-.75Zm-5.47,14.52h-3.56v-3.34h3.56v3.34Zm2.48-4.84H3.74v-3.34H12.25v3.34Zm2.24-4.84H1.5V1.5H14.5v3.34Z" />
      )}
    </SvgIcon>
  );
}
