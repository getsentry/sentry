import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Flex, type FlexProps, Grid, type GridProps} from '@sentry/scraps/layout';

const motionProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {animate: {}},
  transition: {staggerChildren: 0.2},
};

/**
 * Height of the fixed footer bar. Exported so steps can reserve matching bottom
 * clearance — the bar overlays their content. Too large for the space scale.
 */
export const FOOTER_HEIGHT = '72px';

const footerChromeStyles = (theme: Theme) => css`
  width: 100%;
  position: fixed;
  bottom: 0;
  left: 0;
  height: ${FOOTER_HEIGHT};
  z-index: 100;
  background-color: ${theme.tokens.background.primary};
  border-top: 1px solid ${theme.tokens.border.secondary};
`;

export function GenericFooter(
  props: React.ComponentProps<typeof motion.div> & FlexProps
) {
  return <MotionFlex {...motionProps} {...props} />;
}

export function GridFooter(props: React.ComponentProps<typeof motion.div> & GridProps) {
  return (
    <MotionGrid
      // Viewport-driven (`screen:`) rather than container-driven: the bar is
      // `position: fixed` at `width: 100%`, so its own width is the viewport's.
      // Below sm the leading and status slots hide themselves, which takes them
      // out of grid flow — so a single track leaves the one remaining slot
      // spanning the full width, flush to the trailing edge.
      columns={{'screen:2xs': '1fr', 'screen:sm': 'repeat(3, 1fr)'}}
      {...motionProps}
      {...props}
    />
  );
}

const StyledFlex = styled(Flex)`
  ${p => footerChromeStyles(p.theme)};
  justify-content: space-between;
`;

const StyledGrid = styled(Grid)`
  ${p => footerChromeStyles(p.theme)};
`;

const MotionFlex = motion.create(StyledFlex);
const MotionGrid = motion.create(StyledGrid);
