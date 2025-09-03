import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export function IconReleases(props: SVGIconProps) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} kind={theme.isChonk ? 'stroke' : 'path'}>
      {theme.isChonk ? (
        <Fragment>
          <rect
            className="cls-1"
            x="2.75"
            y="7.75"
            width="10.5"
            height="5.5"
            rx=".5"
            ry=".5"
          />
          <path
            className="cls-1"
            d="m12.5,7.75v-2c0-.28-.22-.5-.5-.5H4c-.28,0-.5.22-.5.5v2h9Z"
          />
          <path
            className="cls-1"
            d="m11.75,5.25v-2c0-.28-.22-.5-.5-.5h-6.5c-.28,0-.5.22-.5.5v2h7.5Z"
          />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M14.77,16H1.23A1.26,1.26,0,0,1,0,14.75V6.52A1.25,1.25,0,0,1,1.23,5.27H14.77A1.25,1.25,0,0,1,16,6.52v8.23A1.26,1.26,0,0,1,14.77,16ZM1.48,14.5h13V6.77h-13Z" />
          <path d="M14.71,6h-1.5V4.14H2.79V6H1.29V3.89A1.25,1.25,0,0,1,2.54,2.64H13.46a1.25,1.25,0,0,1,1.25,1.25Z" />
          <path d="M13.37,3.39h-1.5V1.5H4.13V3.39H2.63V1.25A1.26,1.26,0,0,1,3.88,0h8.24a1.26,1.26,0,0,1,1.25,1.25Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
