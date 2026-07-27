import {css} from '@emotion/react';
import styled from '@emotion/styled';
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

/**
 * Height of the fixed footer bar. Exported so steps can reserve space for it —
 * it overlays their content, so they need matching bottom clearance. Too large
 * for the space scale, which stops at 3xl.
 */
export const FOOTER_HEIGHT = '72px';

// The bar both footers pin to the bottom of the viewport. Every property is a
// Container prop except the stacking order, which has none.
const footerChromeProps = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  width: '100%',
  height: FOOTER_HEIGHT,
  background: 'primary',
  borderTop: 'secondary',
} as const satisfies ContainerProps;

const zIndexStyles = css`
  z-index: 100;
`;

export function GenericFooter(
  props: React.ComponentProps<typeof motion.div> & FlexProps
) {
  return (
    <MotionFlex {...footerChromeProps} justify="between" {...motionProps} {...props} />
  );
}

export function GridFooter(props: React.ComponentProps<typeof motion.div> & GridProps) {
  return (
    <FooterChrome {...footerChromeProps} containerType="inline-size">
      <MotionGrid
        height="100%"
        // Below xl the leading and status slots hide themselves, which takes
        // them out of grid flow entirely — so a single track leaves the one
        // remaining slot spanning the full width, flush to the trailing edge.
        columns={{zero: '1fr', xl: 'repeat(3, 1fr)'}}
        {...motionProps}
        {...props}
      />
    </FooterChrome>
  );
}

const StyledFlex = styled(Flex)`
  ${zIndexStyles};
`;

// The chrome is the query container for the footer's contents. It has to be a
// separate element from the layout below because an element can't query itself,
// and it's the outermost node the footer owns, so containment can't re-anchor
// any `position: fixed` ancestor.
const FooterChrome = styled(Container)`
  ${zIndexStyles};
`;

const MotionFlex = motion.create(StyledFlex);
const MotionGrid = motion.create(Grid);
