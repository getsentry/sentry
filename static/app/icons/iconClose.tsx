import {Fragment} from 'react';
import {useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  ['data-test-id']?: string;
  /**
   * @deprecated circled variant will be removed.
   */
  isCircled?: boolean;
}

export function IconClose({
  ['data-test-id']: dataTestId = 'icon-close',
  isCircled = false,
  ...props
}: Props) {
  const theme = useTheme();
  return (
    <SvgIcon {...props} data-test-id={dataTestId}>
      {theme.isChonk ? (
        <path d="M12.72 2.22C13.01 1.93 13.49 1.93 13.78 2.22C14.07 2.51 14.07 2.99 13.78 3.28L9.06 8L13.78 12.72C14.07 13.01 14.07 13.49 13.78 13.78C13.49 14.07 13.01 14.07 12.72 13.78L8 9.06L3.28 13.78C2.99 14.07 2.51 14.07 2.22 13.78C1.93 13.49 1.93 13.01 2.22 12.72L6.94 8L2.22 3.28C1.93 2.99 1.93 2.51 2.22 2.22C2.51 1.93 2.99 1.93 3.28 2.22L8 6.94L12.72 2.22Z" />
      ) : isCircled ? (
        <Fragment>
          <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
          <path d="M5.34,11.41a.71.71,0,0,1-.53-.22.74.74,0,0,1,0-1.06l5.32-5.32a.75.75,0,0,1,1.06,1.06L5.87,11.19A.74.74,0,0,1,5.34,11.41Z" />
          <path d="M10.66,11.41a.74.74,0,0,1-.53-.22L4.81,5.87A.75.75,0,0,1,5.87,4.81l5.32,5.32a.74.74,0,0,1,0,1.06A.71.71,0,0,1,10.66,11.41Z" />
        </Fragment>
      ) : (
        <Fragment>
          <path d="M6.94,8,1.47,13.47a.75.75,0,0,0,0,1.06.75.75,0,0,0,1.06,0L8,9.06l5.47,5.47a.75.75,0,0,0,1.06,0,.75.75,0,0,0,0-1.06L9.06,8l5.47-5.47a.75.75,0,0,0-1.06-1.06L8,6.94,2.53,1.47A.75.75,0,0,0,1.47,2.53Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
