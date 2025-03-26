import {forwardRef} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

const IconAttachment = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  const theme = useTheme();
  return (
    <SvgIcon {...props} ref={ref} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <path d="m14.19,7.12l-5.13,5.13c-1.46,1.46-3.84,1.46-5.3,0h0c-1.46-1.46-1.46-3.84,0-5.3L7.82,2.87c.98-.98,2.56-.98,3.54,0h0c.98.98.98,2.56,0,3.54l-4.07,4.07c-.49.49-1.28.49-1.77,0h0c-.49-.49-.49-1.28,0-1.77l4.07-4.07" />
      ) : (
        <path d="M4.49,15.79l-.38,0a4.33,4.33,0,0,1-3-1.56A4.41,4.41,0,0,1,1.66,8L10,1a3.33,3.33,0,1,1,4.28,5.1L6,13.06A2.2,2.2,0,0,1,3.17,9.68l8.31-7a.75.75,0,0,1,1,1.15l-8.31,7a.73.73,0,0,0-.25.48.71.71,0,0,0,.16.51.71.71,0,0,0,1,.09l8.31-7A1.84,1.84,0,0,0,14,3.7a1.82,1.82,0,0,0-3-1.56l-8.31,7a2.91,2.91,0,0,0,1.55,5.17,2.89,2.89,0,0,0,2.11-.67l8.38-7a.75.75,0,0,1,1,.1.74.74,0,0,1-.09,1.05l-8.31,7A4.47,4.47,0,0,1,4.49,15.79Z" />
      )}
    </SvgIcon>
  );
});

IconAttachment.displayName = 'IconAttachment';

export {IconAttachment};
