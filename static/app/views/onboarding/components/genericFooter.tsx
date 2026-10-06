import {createPortal} from 'react-dom';
import {motion} from 'framer-motion';

import {
  Container,
  type ContainerProps,
  Grid,
  type GridProps,
} from '@sentry/scraps/layout';

import {ONBOARDING_STAGGER} from 'sentry/views/onboarding/animations';

export const FOOTER_HEIGHT = '72px';

const footerChromeProps = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  width: '100%',
  height: FOOTER_HEIGHT,
  background: 'primary',
  borderTop: 'secondary',
  style: {zIndex: 100},
} as const satisfies ContainerProps;

export function GridFooter(props: React.ComponentProps<typeof motion.div> & GridProps) {
  return createPortal(
    // The footer renders outside the onboarding page's query container so its
    // fixed position remains relative to the viewport. It needs its own query
    // container for its responsive slots.
    <Container {...footerChromeProps} containerType="inline-size">
      <MotionGrid
        height="100%"
        // Below xl the hidden slots leave a single visible child. Flowing in
        // one column-direction row keeps it on the footer's baseline; explicit
        // equal tracks would put each child on its own row instead.
        flow={{zero: 'column', xl: 'row'}}
        columns={{zero: 'none', xl: 'repeat(3, 1fr)'}}
        {...ONBOARDING_STAGGER}
        {...props}
      />
    </Container>,
    document.body
  );
}

const MotionGrid = motion.create(Grid);
