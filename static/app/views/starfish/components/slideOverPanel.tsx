import type {ForwardedRef} from 'react';
import {forwardRef, Fragment, useEffect} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import {Backdrop} from 'sentry/components/globalModal';

const BACKDROP_OPACITY = 0.5;
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
    <Fragment>
      <Backdrop
        style={collapsed ? {} : {opacity: BACKDROP_OPACITY, pointerEvents: 'none'}}
      />

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
    </Fragment>
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
  ${p =>
    p.slidePosition === 'bottom'
      ? `
      width: 100%;
      height: ${PANEL_HEIGHT};
      position: sticky;
    `
      : `
      width: ${PANEL_WIDTH};
      height: 100%;
      position: fixed;
      top: 0;
    `}
  box-shadow: ${p => p.theme.dropShadowHeavy};
  bottom: 0;
  right: 0;
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
  text-align: left;
  z-index: ${p => p.theme.zIndex.modal + 1};
  ${p =>
    p.collapsed
      ? 'overflow: hidden;'
      : `overflow-x: hidden;
  overflow-y: scroll;`}
`;
