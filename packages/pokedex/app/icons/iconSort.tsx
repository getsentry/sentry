import {forwardRef} from 'react';
import {css} from '@emotion/react';

import {SvgIcon, SVGIconProps} from './svgIcon';

interface Props extends SVGIconProps {
  rotated?: boolean;
}

const IconSort = forwardRef<SVGSVGElement, Props>(({rotated, ...props}, ref) => {
  return (
    <SvgIcon
      {...props}
      ref={ref}
      css={
        rotated &&
        css`
          transform: rotate(90deg);
        `
      }
    >
      <path d="M15.49 11.76a.75.75 0 0 1-.22.53l-2.88 2.88a.75.75 0 0 1-1.06 0l-2.87-2.88a.74.74 0 0 1 0-1.06.75.75 0 0 1 1.06 0l2.34 2.35 2.35-2.35a.75.75 0 0 1 1.06 0 .79.79 0 0 1 .22.53Z" />
      <path d="M12.61 1.34v13.3a.75.75 0 1 1-1.5 0V1.34a.75.75 0 1 1 1.5 0Z" />
      <path d="M7.87 4.22a.74.74 0 0 1-.22.53.75.75 0 0 1-1.06 0L4.25 2.4 1.9 4.75A.75.75 0 0 1 .84 3.69L3.72.81a.75.75 0 0 1 1.06 0l2.87 2.88a.74.74 0 0 1 .22.53Z" />
      <path d="M5 1.34v13.3a.75.75 0 1 1-1.5 0V1.34a.75.75 0 0 1 1.5 0Z" />
    </SvgIcon>
  );
});

IconSort.displayName = 'IconSort';

export {IconSort};
