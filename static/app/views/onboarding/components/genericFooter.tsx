import {motion} from 'framer-motion';

import {
  Container,
  type ContainerProps,
  Flex,
  type FlexProps,
  Grid,
  type GridProps,
} from '@sentry/scraps/layout';

const motionProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {animate: {}},
  transition: {staggerChildren: 0.2},
};

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

export function GenericFooter(
  props: React.ComponentProps<typeof motion.div> & FlexProps
) {
  return (
    <MotionFlex {...footerChromeProps} justify="between" {...motionProps} {...props} />
  );
}

export function GridFooter(props: React.ComponentProps<typeof motion.div> & GridProps) {
  return (
    // A separate element from the grid below: an element can't query itself, and
    // this is the outermost node the footer owns, so its containment can't
    // re-anchor a `position: fixed` ancestor.
    <Container {...footerChromeProps} containerType="inline-size">
      <MotionGrid
        height="100%"
        // Below xl the hidden slots leave a single visible child. Flowing in
        // one column-direction row keeps it on the footer's baseline; explicit
        // equal tracks would put each child on its own row instead.
        flow={{zero: 'column', xl: 'row'}}
        columns={{zero: 'none', xl: 'repeat(3, 1fr)'}}
        {...motionProps}
        {...props}
      />
    </Container>
  );
}

const MotionFlex = motion.create(Flex);
const MotionGrid = motion.create(Grid);
