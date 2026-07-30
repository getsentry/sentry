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
    <FooterChrome>
      <MotionGrid
        height="100%"
        columns={{zero: '1fr', xl: 'repeat(3, 1fr)'}}
        {...motionProps}
        {...props}
      />
    </FooterChrome>
  );
}

const StyledFlex = styled(Flex)`
  ${p => footerChromeStyles(p.theme)};
  justify-content: space-between;
`;

const FooterChrome = styled('div')`
  ${p => footerChromeStyles(p.theme)};
  container-type: inline-size;
`;

const MotionFlex = motion.create(StyledFlex);
const MotionGrid = motion.create(Grid);
