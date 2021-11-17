import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Widget} from './types';

const getBigNumberArea = size => {
  switch (size) {
    case 'small':
      return `span 1/ span 1`;
    case 'medium':
      return `span 1/ span 2`;
    case 'large':
      return `span 1/ span 3`;
    default:
      return `span 1/ span 2`;
  }
};

const getDefaultWidgetArea = size => {
  switch (size) {
    case 'small':
      return `span 2/ span 2`;
    case 'medium':
      return `span 2/ span 3`;
    case 'large':
      return `span 2/ span 4`;
    default:
      return `span 2/ span 2`;
  }
};

const WidgetWrapper = styled(motion.div)<{
  displayType: Widget['displayType'];
  size?: string;
}>`
  position: relative;
  touch-action: manipulation;

  ${p => {
    switch (p.displayType) {
      case 'big_number':
        return `
          /* 2 cols */
          grid-area: span 1 / span 2;

          @media (min-width: ${p.theme.breakpoints[0]}) {
            /* 4 cols */
            grid-area: span 1 / span 1;
          }

          @media (min-width: ${p.theme.breakpoints[3]}) {
            /* 6 and 8 cols */
            grid-area: ${getBigNumberArea(p.size)};
          }
        `;
      default:
        return `
          /* 2, 4, 6 and 8 cols */
          grid-area: ${getDefaultWidgetArea(p.size)};
        `;
    }
  }};
`;

export default WidgetWrapper;
