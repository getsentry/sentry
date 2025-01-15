import type {HTMLAttributes} from 'react';
import styled from '@emotion/styled';
import type {AnimationControls} from 'framer-motion';
import {motion} from 'framer-motion';

import testableTransition from 'sentry/utils/testableTransition';

type Props = {
  animateVariant: AnimationControls;
} & HTMLAttributes<HTMLDivElement>;

function PageCorners({animateVariant, ...rest}: Props) {
  return (
    <Container {...rest}>
      <TopRight
        key="tr"
        width="874"
        height="203"
        viewBox="0 0 874 203"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={animateVariant}
        initial={{
          x: '40px',
          opacity: 0,
          originX: '100%',
          originY: 0,
          scale: 'var(--corner-scale)',
        }}
        variants={{
          none: {x: '40px', opacity: 0},
          'top-left': {x: '40px', opacity: 0},
          'top-right': {x: 0, opacity: 1},
        }}
        transition={transition}
      >
        <path
          d="M36.5 0H874v203l-288.7-10-7-114-180.2-4.8-3.6-35.2-351.1 2.5L36.5 0z"
          fill="currentColor"
        />
        <path
          d="M535.5 111.5v-22l31.8 1 .7 21.5-32.5-.5zM4 43.5L0 21.6 28.5 18l4.2 24.7-28.7.8z"
          fill="currentColor"
        />
      </TopRight>
      <BottomLeft
        key="bl"
        width="494"
        height="141"
        viewBox="0 0 494 141"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={animateVariant}
        initial={{
          x: '-40px',
          opacity: 0,
          originX: 0,
          originY: '100%',
          scale: 'var(--corner-scale)',
        }}
        variants={{
          none: {x: '-40px', opacity: 0},
          'top-left': {x: '-40px', opacity: 0},
          'top-right': {x: 0, opacity: 1},
        }}
        transition={transition}
      >
        <path d="M494 141H-1V7l140-7v19h33l5 82 308 4 9 36z" fill="currentColor" />
        <path d="M219 88h-30l-1-19 31 3v16z" fill="currentColor" />
      </BottomLeft>
      <TopLeft
        key="tl"
        width="414"
        height="118"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={animateVariant}
        initial={{
          x: '-40px',
          opacity: 0,
          originX: 0,
          originY: 0,
          scale: 'var(--corner-scale)',
        }}
        variants={{
          none: {x: '-40px', opacity: 0},
          'top-right': {x: '-40px', opacity: 0},
          'top-left': {x: 0, opacity: 1},
        }}
        transition={transition}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M414 0H0v102h144l5-69 257-3 8-30zM0 112v-10h117v16L0 112z"
          fill="currentColor"
        />
        <path d="M184 44h-25l-1 16 26-2V44z" fill="currentColor" />
      </TopLeft>
      <BottomRight
        key="br"
        width="650"
        height="151"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        animate={animateVariant}
        initial={{
          x: '40px',
          opacity: 0,
          originX: '100%',
          originY: '100%',
          scale: 'var(--corner-scale)',
        }}
        variants={{
          none: {x: '40px', opacity: 0},
          'top-right': {x: '40px', opacity: 0},
          'top-left': {x: 0, opacity: 1},
        }}
        transition={transition}
      >
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M27 151h623V0L435 7l-5 85-134 4-3 26-261-2-5 31z"
          fill="currentColor"
        />
        <path d="M398 68v16h24l1-16h-25zM3 119l-3 16 21 3 3-19H3z" fill="currentColor" />
      </BottomRight>
    </Container>
  );
}

export default PageCorners;

const transition = testableTransition({
  type: 'spring',
  duration: 0.8,
});

const TopLeft = styled(motion.svg)`
  position: absolute;
  top: 0;
  left: 0;
`;

const TopRight = styled(motion.svg)`
  position: absolute;
  top: 0;
  right: 0;
`;

const BottomLeft = styled(motion.svg)`
  position: absolute;
  bottom: 0;
  left: 0;
`;

const BottomRight = styled(motion.svg)`
  position: absolute;
  bottom: 0;
  right: 0;
`;

const Container = styled('div')`
  pointer-events: none;
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  color: ${p => p.theme.purple200};
  opacity: 0.4;
`;
