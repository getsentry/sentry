import * as React from 'react';
import styled from '@emotion/styled';
import {keyframes} from '@emotion/core';

import SvgIcon from './svgIcon';

type WrappedProps = {
  forwardRef: React.Ref<SVGSVGElement>;
} & Props;

const IconBusinessComponent = function IconBusinessComponent({
  gradient = false,
  withShine = false,
  forwardRef,
  ...props
}: WrappedProps) {
  return (
    <SvgIcon {...props} ref={forwardRef}>
      <mask id="icon-power-features-mask">
        <path
          fill="white"
          id="power-feature"
          d="M6.4 3.2001C3.7492 3.2001 1.6 5.3493 1.6 8.0001C1.6 10.6509 3.7492 12.8001 6.4 12.8001H9.6C12.2508 12.8001 14.4 10.6509 14.4 8.0001C14.4 5.3493 12.2508 3.2001 9.6 3.2001H6.4ZM6.4 1.6001H9.6C13.1348 1.6001 16 4.4653 16 8.0001C16 11.5349 13.1348 14.4001 9.6 14.4001H6.4C2.8652 14.4001 0 11.5349 0 8.0001C0 4.4653 2.8652 1.6001 6.4 1.6001ZM9.7128 3.6189L8.758 6.4161C8.7294 6.50034 8.73256 6.5921 8.76688 6.67418C8.8012 6.75622 8.86436 6.82294 8.9444 6.8617L10.8056 7.7721C10.8584 7.79754 10.9042 7.83534 10.9392 7.88226C10.9743 7.92922 10.9975 7.9839 11.007 8.0417C11.0164 8.09954 11.0117 8.15878 10.9934 8.21438C10.975 8.27002 10.9436 8.32042 10.9016 8.3613L6.592 12.5701C6.55684 12.6043 6.50968 12.6232 6.46068 12.6229C6.41168 12.6226 6.36472 12.6031 6.33 12.5685C6.30588 12.5445 6.28896 12.5143 6.2812 12.4812C6.2734 12.4481 6.27508 12.4135 6.286 12.3813L7.2416 9.5817C7.27016 9.49738 7.26688 9.40554 7.2324 9.32346C7.19792 9.24138 7.1346 9.17474 7.0544 9.1361L5.1944 8.2281C5.14156 8.20266 5.09564 8.16486 5.06056 8.1179C5.02544 8.07094 5.0022 8.01618 4.99276 7.9583C4.98336 7.90046 4.98804 7.84114 5.00644 7.78546C5.0248 7.72978 5.05636 7.67938 5.0984 7.6385L9.4068 3.4301C9.44196 3.39594 9.48912 3.37696 9.53812 3.37726C9.58716 3.37756 9.63408 3.39711 9.6688 3.4317C9.69292 3.45565 9.70984 3.4859 9.7176 3.519C9.7254 3.55209 9.72372 3.58671 9.7128 3.6189Z"
        />
      </mask>
      <linearGradient id="icon-power-features-gradient">
        <stop offset="0%" stopColor="#EA5BC2" />
        <stop offset="100%" stopColor="#6148CE" />
      </linearGradient>
      <linearGradient id="icon-power-features-shine" gradientTransform="rotate(35)">
        <stop offset="0%" stopColor="rgba(255, 255, 255, 0)" />
        <stop offset="50%" stopColor="rgba(255, 255, 255, 1)" />
        <stop offset="100%" stopColor="rgba(255, 255, 255, 0)" />
      </linearGradient>
      <rect
        fill={gradient ? 'url(#icon-power-features-gradient)' : 'currentColor'}
        mask="url(#icon-power-features-mask)"
        height="100%"
        width="100%"
      />

      {withShine && (
        <g mask="url(#icon-power-features-mask)">
          <ShineRect fill="url(#icon-power-features-shine" height="100%" width="100%" />
        </g>
      )}
    </SvgIcon>
  );
};

type Props = {
  /**
   * Renders a pink purple gradient on the icon
   */
  gradient?: boolean;

  /**
   * Adds an animated shine to the icon
   */
  withShine?: boolean;
} & React.ComponentProps<typeof SvgIcon>;

const IconBusiness = React.forwardRef((props: Props, ref: React.Ref<SVGSVGElement>) => (
  <IconBusinessComponent {...props} forwardRef={ref} />
));

IconBusiness.displayName = 'IconBusiness';

const shine = keyframes`
  0% {
    transform: translateX(-100%);
  }
  94% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(100%);
  }
`;

const ShineRect = styled('rect')`
  transform: translateX(-100%);
  animation: ${shine} 8s ease-in-out infinite;
`;

export {IconBusiness};
