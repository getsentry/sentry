import {forwardRef, Fragment} from 'react';
import {css, useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

interface Props extends SVGIconProps {
  direction?: 'up' | 'right' | 'down' | 'left';
  isCircled?: boolean;
  isDouble?: boolean;
}

const CHEVRON_PATH = (
  <path d="M14,11.75a.74.74,0,0,1-.53-.22L8,6.06,2.53,11.53a.75.75,0,0,1-1.06-1.06l6-6a.75.75,0,0,1,1.06,0l6,6a.75.75,0,0,1,0,1.06A.74.74,0,0,1,14,11.75Z" />
);

function getChevronPath({isCircled, isDouble}: Pick<Props, 'isCircled' | 'isDouble'>) {
  if (isCircled) {
    return (
      <Fragment>
        <path d="M8,16a8,8,0,1,1,8-8A8,8,0,0,1,8,16ZM8,1.53A6.47,6.47,0,1,0,14.47,8,6.47,6.47,0,0,0,8,1.53Z" />
        <path d="M11.12,9.87a.73.73,0,0,1-.53-.22L8,7.07,5.41,9.65a.74.74,0,0,1-1.06,0,.75.75,0,0,1,0-1.06L7.47,5.48a.74.74,0,0,1,1.06,0l3.12,3.11a.75.75,0,0,1,0,1.06A.74.74,0,0,1,11.12,9.87Z" />
      </Fragment>
    );
  }

  if (isDouble) {
    return (
      <Fragment>
        <g transform="translate(0 -4)">{CHEVRON_PATH}</g>
        <g transform="translate(0 4)">{CHEVRON_PATH}</g>
      </Fragment>
    );
  }

  return CHEVRON_PATH;
}

const IconChevron = forwardRef<SVGSVGElement, Props>(
  ({isDouble, isCircled, direction = 'up', ...props}, ref) => {
    const theme = useTheme();

    return (
      <SvgIcon
        {...props}
        ref={ref}
        css={
          direction
            ? css`
                transition: transform 120ms ease-in-out;
                transform: rotate(${theme.iconDirections[direction]}deg);
              `
            : undefined
        }
      >
        {getChevronPath({isDouble, isCircled})}
      </SvgIcon>
    );
  }
);

IconChevron.displayName = 'IconChevron';

export {IconChevron};
