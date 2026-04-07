import styled from '@emotion/styled';
import {type MotionNodeAnimationOptions} from 'framer-motion';

import {inlineCodeStyles} from '@sentry/scraps/code';

import {MarkedText} from 'sentry/utils/marked/markedText';

/**
 * Animation props for artifact cards and status cards.
 */
export const cardAnimationProps: MotionNodeAnimationOptions = {
  exit: {opacity: 0, height: 0, scale: 0.8, y: -20},
  initial: {opacity: 0, height: 0, scale: 0.8},
  animate: {opacity: 1, height: 'auto', scale: 1},
  transition: {
    duration: 0.12,
    height: {
      type: 'spring',
      bounce: 0.2,
    },
    scale: {
      type: 'spring',
      bounce: 0.2,
    },
    y: {
      type: 'tween',
      ease: 'easeOut',
    },
  },
};

/**
 * Styled MarkedText component with inline code styling.
 * Used for rendering markdown content in artifact cards and status cards.
 */
export const StyledMarkedText = styled(MarkedText)`
  code:not(pre code) {
    ${p => inlineCodeStyles(p.theme)};
  }
`;
