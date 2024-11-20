import {forwardRef} from 'react';
import styled from '@emotion/styled';

import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {SvgIcon} from 'sentry/icons/svgIcon';

const SeerIcon = forwardRef<SVGSVGElement, SVGIconProps>((props, ref) => {
  return (
    <SvgIcon {...props} ref={ref} viewBox="0 0 30 30">
      <StyledPath d="M14.0407,3.1458L3.5742,17.0376c-.2989.3967-.2327.9584.1501,1.2748l10.4917,8.6705c.3436.284.8405.2838,1.1839-.0005l10.4717-8.6691c.3827-.3169.4483-.8788.1488-1.2753L15.5235,3.1448c-.3719-.4922-1.1115-.4917-1.4828.001Z" />
      <StyledPath d="M14.1483,12.3135l-5.1122,4.0552c-.3332.2643-.314.6812.0426.9278l5.1121,3.5339c.3337.2307.8482.2312,1.1828.0012l5.1412-3.534c.359-.2468.3782-.6657.0427-.9303l-5.1411-4.0551c-.3449-.272-.9243-.2714-1.2682.0013Z" />
      <StyledLine x1="14.7558" y1="15.9343" x2="14.7558" y2="17.2053" />
    </SvgIcon>
  );
});

SeerIcon.displayName = 'SeerIcon';

export {SeerIcon};

const StyledPath = styled('path')`
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.25px;
`;

const StyledLine = styled('line')`
  fill: none;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2.25px;
`;
