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

function IconClose({
  ['data-test-id']: dataTestId = 'icon-close',
  isCircled = false,
  ...props
}: Props) {
  const theme = useTheme();
  return (
    <SvgIcon
      {...props}
      data-test-id={dataTestId}
      kind={theme.isChonk ? 'stroke' : 'path'}
    >
      {theme.isChonk ? (
        <Fragment>
          <line x1="12.24" y1="3.76" x2="3.75" y2="12.25" />
          <line x1="12.24" y1="12.25" x2="3.75" y2="3.76" />
        </Fragment>
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

IconClose.displayName = 'IconClose';

export {IconClose};
