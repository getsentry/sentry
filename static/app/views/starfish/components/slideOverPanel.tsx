import type {ForwardedRef} from 'react';
import {forwardRef, useEffect} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {space} from 'sentry/styles/space';

const PANEL_WIDTH = '50vw';
const PANEL_HEIGHT = '50vh';

const INITIAL_STYLES = {
  bottom: {opacity: 0, x: 0, y: 0},
  right: {opacity: 0, x: PANEL_WIDTH, y: 0},
};

const FINAL_STYLES = {
  bottom: {opacity: 0, x: 0, y: PANEL_HEIGHT},
  right: {opacity: 0, x: PANEL_WIDTH},
};

type SlideOverPanelProps = {
  children: React.ReactNode;
  collapsed: boolean;
  onOpen?: () => void;
  slidePosition?: 'right' | 'bottom';
};

export default forwardRef(SlideOverPanel);

function SlideOverPanel(
  {collapsed, children, onOpen, slidePosition}: SlideOverPanelProps,
  ref: ForwardedRef<HTMLDivElement>
) {
  useEffect(() => {
    if (!collapsed && onOpen) {
      onOpen();
    }
  }, [collapsed, onOpen]);
  const initial = slidePosition ? INITIAL_STYLES[slidePosition] : INITIAL_STYLES.right;
  const final = slidePosition ? FINAL_STYLES[slidePosition] : FINAL_STYLES.right;

  return (
    <_SlideOverPanel
      ref={ref}
      collapsed={collapsed}
      initial={initial}
      animate={!collapsed ? {opacity: 1, x: 0, y: 0} : final}
      slidePosition={slidePosition}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 50,
      }}
    >
      {children}
    </_SlideOverPanel>
  );
}

const _SlideOverPanel = styled(motion.div, {
  shouldForwardProp: prop =>
    ['animate', 'transition', 'initial'].includes(prop) ||
    (prop !== 'collapsed' && isPropValid(prop)),
})<{
  collapsed: boolean;
  slidePosition?: 'right' | 'bottom';
}>`
  position: fixed;

  top: ${space(2)};
  right: 0;
  bottom: ${space(2)};
  left: ${space(2)};

  overflow: auto;

  z-index: ${p => p.theme.zIndex.modal + 1};

  box-shadow: ${p => p.theme.dropShadowHeavy};
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};

  text-align: left;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    ${p =>
      p.slidePosition === 'bottom'
        ? css`
            position: sticky;

            width: 100%;
            height: ${PANEL_HEIGHT};

            right: 0;
            bottom: 0;
            left: 0;
          `
        : css`
            position: fixed;

            width: ${PANEL_WIDTH};
            height: 100%;

            top: 0;
            right: 0;
            bottom: 0;
            left: auto;
          `}
  }

  ${p =>
    p.collapsed
      ? css`
          overflow: hidden;
        `
      : css`
          overflow-x: hidden;
          overflow-y: auto;
        `}
`;
