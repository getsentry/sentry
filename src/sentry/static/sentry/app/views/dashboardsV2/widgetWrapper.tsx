import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Widget} from './types';

const WidgetWrapper = styled(motion.div)<{displayType: Widget['displayType']}>`
  position: relative;
  /* Min-width prevents grid items from stretching the grid */
  min-width: 200px;
  touch-action: manipulation;

  ${p => {
    switch (p.displayType) {
      case 'big_number':
        return `
          /* 2 cols */
          grid-area: span 1 / span 2;

          @media (min-width: ${p.theme.breakpoints[1]}) {
            /* 4 cols */
            grid-area: span 1 / span 2;
          }

          @media (min-width: ${p.theme.breakpoints[3]}) {
            /* 6 cols */
            grid-area: span 1 / span 3;
          }

          @media (min-width: ${p.theme.breakpoints[4]}) {
            /* 8 cols */
            grid-area: span 1 / span 2;
          }
        `;
      default:
        return `
          /* 2 cols */
          grid-area: span 2 / span 2;

          @media (min-width: ${p.theme.breakpoints[1]}) {
            /* 4 cols */
            grid-area: span 2 / span 4;
          }

          @media (min-width: ${p.theme.breakpoints[3]}) {
            /* 6 cols */
            grid-area: span 2 / span 3;
          }

          @media (min-width: ${p.theme.breakpoints[4]}) {
            /* 8 cols */
            grid-area: span 2 / span 2;
          }
        `;
    }
  }};
`;

export default WidgetWrapper;
