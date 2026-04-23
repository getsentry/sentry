import type {Theme} from '@emotion/react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Flex, type FlexProps} from '@sentry/scraps/layout';

const motionProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {animate: {}},
  transition: {staggerChildren: 0.2},
};

const footerChromeStyles = (theme: Theme) => css`
  width: 100%;
  position: fixed;
  bottom: 0;
  left: 0;
  height: 72px;
  z-index: 100;
  background-color: ${theme.tokens.background.primary};
  /* TODO(design-engineering): Replace with a directional shadow token when one exists */
  box-shadow:
    0px -4px 0px 2px ${theme.tokens.elevation.high},
    0px -1px 0px 1px ${theme.tokens.elevation.high};
`;

export function GenericFooter(
  props: React.ComponentProps<typeof motion.div> & FlexProps
) {
  return <MotionFlex {...motionProps} {...props} />;
}

export function GridFooter(props: React.ComponentProps<typeof motion.div>) {
  return <MotionGrid {...motionProps} {...props} />;
}

const StyledFlex = styled(Flex)`
  ${p => footerChromeStyles(p.theme)};
  justify-content: space-between;
`;

const StyledGrid = styled('div')`
  ${p => footerChromeStyles(p.theme)};
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: flex;
    flex-direction: row;
    justify-content: end;
  }
`;

const MotionFlex = motion.create(StyledFlex);
const MotionGrid = motion.create(StyledGrid);
