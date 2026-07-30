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

export const FOOTER_HEIGHT = '72px';

const footerChromeProps = {
  position: 'fixed',
  bottom: 0,
  left: 0,
  width: '100%',
  height: FOOTER_HEIGHT,
  background: 'primary',
  borderTop: 'secondary',
} as const satisfies ContainerProps;

// z-index is the only chrome property with no layout prop.
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
    // A separate element from the grid below: an element can't query itself, and
    // this is the outermost node the footer owns, so its containment can't
    // re-anchor a `position: fixed` ancestor.
    <FooterChrome {...footerChromeProps} containerType="inline-size">
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
    </FooterChrome>
  );
}

// Styled rather than composed: the render-prop form replaces the element instead
// of wrapping it, so it can't host the callers' children.
const MotionFlex = motion.create(styled(Flex)`
  ${zIndexStyles};
`);

const FooterChrome = styled(Container)`
  ${zIndexStyles};
`;

const MotionGrid = motion.create(Grid);
