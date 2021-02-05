import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Widget} from './types';

export const WidgetWrapper = styled(motion.div)<{displayType: Widget['displayType']}>`
  position: relative;
  /* Min-width prevents grid items from stretching the grid */
  min-width: 200px;
  touch-action: manipulation;

  ${p => {
    switch (p.displayType) {
      case 'big_number':
        return 'grid-area: span 1 / span 1;';
      default:
        return 'grid-area: span 2 / span 2;';
    }
  }};
`;
