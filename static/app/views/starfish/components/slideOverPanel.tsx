import {ForwardedRef, forwardRef, useEffect} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

const PANEL_WIDTH = '50vw';
const PANEL_HEIGHT = '50vh';

type SlideOverPanelProps = {
  children: React.ReactNode;
  collapsed: boolean;
  onOpen?: () => void;
  slideDirection?: 'Right' | 'Bottom';
};

export default forwardRef(SlideOverPanel);

function SlideOverPanel(
  {collapsed, children, onOpen, slideDirection}: SlideOverPanelProps,
  ref: ForwardedRef<HTMLDivElement>
) {
  useEffect(() => {
    if (!collapsed && onOpen) {
      onOpen();
    }
  }, [collapsed, onOpen]);
  const initial =
    slideDirection === 'Bottom'
      ? {opacity: 0, x: 0, y: 0}
      : {opacity: 0, x: PANEL_WIDTH, y: 0};
  const final =
    slideDirection === 'Bottom'
      ? {opacity: 0, x: 0, y: PANEL_HEIGHT}
      : {opacity: 0, x: PANEL_WIDTH};
  return (
    <_SlideOverPanel
      ref={ref}
      collapsed={collapsed}
      initial={initial}
      animate={!collapsed ? {opacity: 1, x: 0, y: 0} : final}
      slideDirection={slideDirection}
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
  slideDirection?: 'Right' | 'Bottom';
}>`
  ${p =>
    p.slideDirection === 'Bottom'
      ? `
      width: 100%;
      height: ${PANEL_HEIGHT};
      position: sticky;
      border-top: 1px solid ${p.theme.border};
    `
      : `
      width: ${PANEL_WIDTH};
      height: 100%;
      position: fixed;
      top: 0;
      border-left: 1px solid ${p.theme.border};
    `}
  bottom: 0;
  right: 0;
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};
  text-align: left;
  z-index: ${p => p.theme.zIndex.sidebar - 1};
  ${p =>
    p.collapsed
      ? 'overflow: hidden;'
      : `overflow-x: hidden;
  overflow-y: scroll;`}
`;
