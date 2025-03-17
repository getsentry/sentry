import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import type {Widget} from './types';

const WidgetWrapper = styled(motion.div)<{displayType: Widget['displayType']}>`
  position: relative;
  touch-action: manipulation;

  ${p => {
    switch (p.displayType) {
      case 'big_number':
        return css`
          /* 2 cols */
          grid-area: span 1 / span 2;

          @media (min-width: ${p.theme.breakpoints.small}) {
            /* 4 cols */
            grid-area: span 1 / span 1;
          }

          @media (min-width: ${p.theme.breakpoints.xlarge}) {
            /* 6 and 8 cols */
            grid-area: span 1 / span 2;
          }
        `;
      default:
        return css`
          /* 2, 4, 6 and 8 cols */
          grid-area: span 2 / span 2;
        `;
    }
  }};
`;

export default WidgetWrapper;
