import {forwardRef} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  isSolid?: boolean;
}

const IconBookmark = forwardRef<SVGSVGElement, Props>(
  ({isSolid = false, ...props}, ref) => {
    const theme = useTheme();
    return (
      <SvgIcon {...props} ref={ref} kind={theme.isChonk ? 'stroke' : 'path'}>
        {theme.isChonk ? (
          <path d="m5.25,2.75h5.5c.55,0,1,.45,1,1v9.31c0,.23-.29.34-.44.16l-2.92-3.51c-.2-.24-.57-.24-.77,0l-2.92,3.51c-.15.18-.44.07-.44-.16V3.75c0-.55.45-1,1-1Z" />
        ) : isSolid ? (
          <path d="M14.09,16a.71.71,0,0,1-.4-.11L8,12.32,2.31,15.88a.76.76,0,0,1-.76,0,.75.75,0,0,1-.39-.66V2.4A2.38,2.38,0,0,1,3.54,0h8.92A2.38,2.38,0,0,1,14.84,2.4V15.24a.75.75,0,0,1-.39.66A.77.77,0,0,1,14.09,16Z" />
        ) : (
          <path d="M14.09,16a.71.71,0,0,1-.4-.11L8,12.32,2.31,15.88a.76.76,0,0,1-.76,0,.75.75,0,0,1-.39-.66V2.4A2.38,2.38,0,0,1,3.54,0h8.92A2.38,2.38,0,0,1,14.84,2.4V15.24a.75.75,0,0,1-.39.66A.77.77,0,0,1,14.09,16ZM8,10.69a.8.8,0,0,1,.4.11l4.94,3.09V2.4a.88.88,0,0,0-.88-.87H3.54a.88.88,0,0,0-.88.87V13.89L7.6,10.8A.8.8,0,0,1,8,10.69Z" />
        )}
      </SvgIcon>
    );
  }
);

IconBookmark.displayName = 'IconBookmark';

export {IconBookmark};
