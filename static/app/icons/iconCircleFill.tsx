import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

/**
 * @deprecated This icon will be removed in new UI.
 */
export function IconCircleFill(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props}>
      {theme.isChonk ? (
        <path d="M8 0C12.4183 0 16 3.58172 16 8C16 12.4183 12.4183 16 8 16C3.58172 16 0 12.4183 0 8C2.57711e-07 3.58172 3.58172 2.57702e-07 8 0Z" />
      ) : (
        <circle cx="12" cy="12" r="10" />
      )}
    </SvgIcon>
  );
}
