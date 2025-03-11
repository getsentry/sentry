import styled from '@emotion/styled';

import {getChartColorPalette} from 'sentry/constants/chartPalette';

type TopResultsIndicatorProps = {
  count: number;
  index: number;
};

export const TopResultsIndicator = styled('div')<TopResultsIndicatorProps>`
  position: absolute;
  left: -1px;
  margin-top: 4.5px;
  width: 9px;
  height: 15px;
  border-radius: 0 3px 3px 0;

  background-color: ${p => {
    // this background color needs to match the colors used in
    // app/components/charts/eventsChart so that the ordering matches

    // the color pallete contains n + 2 colors, so we subtract 2 here
    return getChartColorPalette(p.count - 2)?.[p.index];
  }};
`;

export default TopResultsIndicator;
