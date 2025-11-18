import {Fragment} from 'react';
import {css, useTheme} from '@emotion/react';

import type {SVGIconProps} from './svgIcon';
import {SvgIcon} from './svgIcon';

export interface ArrowProps extends SVGIconProps {
  direction?: 'up' | 'right' | 'down' | 'left';
}

export function IconArrow({direction = 'up', ...props}: ArrowProps) {
  const theme = useTheme();

  return (
    <SvgIcon
      {...props}
      css={
        direction
          ? direction === 'down'
            ? // Down arrows have a zoom issue with Firefox inside of tables due to rotate.
              // Since arrows are symmetric, scaling to only flip vertically works to fix the issue.
              css`
                transform: scale(1, -1);
              `
            : css`
                transform: rotate(${theme.iconDirections[direction]}deg);
              `
          : undefined
      }
    >
      {theme.isChonk ? (
        <path d="M12.7949 6.73521C13.0793 7.03635 13.0657 7.51038 12.7646 7.79478C12.4635 8.07897 11.9894 8.06557 11.705 7.76451L8.75094 4.6356L8.75094 13.2499C8.75094 13.6639 8.41493 13.9996 8.00094 13.9999C7.58672 13.9999 7.25094 13.6641 7.25094 13.2499L7.25094 4.63365L4.29488 7.76451C4.01045 8.06544 3.53638 8.07913 3.23531 7.79478C2.93446 7.51042 2.92091 7.03629 3.20504 6.73521L7.45504 2.23521C7.45782 2.23227 7.46101 2.22932 7.46383 2.22643C7.47043 2.21966 7.47749 2.2134 7.48434 2.20689C7.51221 2.18038 7.54196 2.15637 7.5732 2.13463C7.58151 2.12885 7.59005 2.12347 7.59859 2.11803C7.63238 2.09649 7.6674 2.07722 7.70406 2.06139C7.71106 2.05837 7.71845 2.05638 7.72555 2.05357C7.81216 2.01927 7.90483 1.99992 7.99996 1.99986C8.09559 1.99986 8.18931 2.01897 8.27633 2.05357C8.28506 2.05703 8.29413 2.05956 8.3027 2.06334C8.3376 2.07876 8.37103 2.09741 8.40328 2.11803C8.4122 2.12372 8.42099 2.12955 8.42965 2.1356C8.4578 2.15532 8.4843 2.17742 8.50973 2.20103C8.52037 2.21092 8.53092 2.22083 8.54098 2.23131C8.54225 2.23264 8.54362 2.23388 8.54488 2.23521L12.7949 6.73521Z" />
      ) : (
        <Fragment>
          <path d="M13.76,7.32a.74.74,0,0,1-.53-.22L8,1.87,2.77,7.1A.75.75,0,1,1,1.71,6L7.47.28a.74.74,0,0,1,1.06,0L14.29,6a.75.75,0,0,1,0,1.06A.74.74,0,0,1,13.76,7.32Z" />
          <path d="M8,15.94a.75.75,0,0,1-.75-.75V.81a.75.75,0,0,1,1.5,0V15.19A.75.75,0,0,1,8,15.94Z" />
        </Fragment>
      )}
    </SvgIcon>
  );
}
