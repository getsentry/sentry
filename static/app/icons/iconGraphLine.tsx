import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconGraphLine(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <path d="m2.75,2.75v9.5c0,.55.45,1,1,1h9.5" />
          <path d="m5.25,10.75l2-3.36c.16-.25.41-.42.71-.46l2.57-.37c.3-.04.56-.22.72-.48l2.01-3.34" />
        </Fragment>
      ) : (
        <path d="M4.38,15.99c-.28,0-.54-.16-.67-.41L.09,8.34c-.19-.37-.04-.82.34-1.01.37-.18.82-.03,1.01.34l2.95,5.9L10.95.42c.13-.25.39-.41.67-.41h0c.28,0,.54.16.67.42l3.62,7.26c.19.37.03.82-.34,1.01-.37.18-.82.03-1.01-.34l-2.95-5.91-6.57,13.14c-.13.25-.39.41-.67.41Z" />
      )}
    </SvgIcon>
  );
}
