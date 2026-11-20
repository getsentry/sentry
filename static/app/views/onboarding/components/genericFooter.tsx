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
  return (
    <Container {...footerChromeProps} containerType="inline-size">
      <MotionGrid
        height="100%"
        align="center"
        gap="md"
        // Equal tracks center the status under the page content, but on narrow
        // screens they squeeze the buttons, so sizing the side tracks to their
        // content leaves the middle track whatever width is left.
        columns={{zero: 'auto 1fr auto', xl: 'repeat(3, 1fr)'}}
        padding={{zero: '0 md', md: '0 3xl'}}
        {...ONBOARDING_STAGGER}
        {...props}
      />
    </Container>
  );
}

const MotionGrid = motion.create(Grid);
