import type {ForwardedRef} from 'react';
import {forwardRef, useEffect} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {type AnimationProps, motion} from 'framer-motion';

import {space} from 'sentry/styles/space';

const PANEL_WIDTH = '50vw';
const PANEL_HEIGHT = '50vh';

const OPEN_STYLES = {
  bottom: {opacity: 1, x: 0, y: 0},
  right: {opacity: 1, x: 0, y: 0},
  left: {opacity: 1, x: 0, y: 0},
};

const COLLAPSED_STYLES = {
  bottom: {opacity: 0, x: 0, y: PANEL_HEIGHT},
  right: {opacity: 0, x: PANEL_WIDTH, y: 0},
  left: {opacity: 0, x: -200, y: 0},
};

type SlideOverPanelProps = {
  children: React.ReactNode;
  collapsed: boolean;
  ariaLabel?: string;
  className?: string;
  'data-test-id'?: string;
  onOpen?: () => void;
  slidePosition?: 'right' | 'bottom' | 'left';
  transitionProps?: AnimationProps['transition'];
};

export default forwardRef(SlideOverPanel);

function SlideOverPanel(
  {
    'data-test-id': testId,
    ariaLabel,
    collapsed,
    children,
    className,
    onOpen,
    slidePosition,
    transitionProps = {},
  }: SlideOverPanelProps,
  ref: ForwardedRef<HTMLDivElement>
) {
  useEffect(() => {
    if (!collapsed && onOpen) {
      onOpen();
    }
  }, [collapsed, onOpen]);

  const openStyle = slidePosition ? OPEN_STYLES[slidePosition] : OPEN_STYLES.right;

  const collapsedStyle = slidePosition
    ? COLLAPSED_STYLES[slidePosition]
    : COLLAPSED_STYLES.right;

  return collapsed ? null : (
    <_SlideOverPanel
      ref={ref}
      initial={collapsedStyle}
      animate={openStyle}
      exit={collapsedStyle}
      slidePosition={slidePosition}
      transition={{
        type: 'spring',
        stiffness: 500,
        damping: 50,
        ...transitionProps,
      }}
      role="complementary"
      aria-hidden={collapsed}
      aria-label={ariaLabel ?? 'slide out drawer'}
      className={className}
      data-test-id={testId}
    >
      {children}
    </_SlideOverPanel>
  );
}

const _SlideOverPanel = styled(motion.div, {
  shouldForwardProp: prop =>
    ['initial', 'animate', 'exit', 'transition'].includes(prop) ||
    (prop !== 'collapsed' && isPropValid(prop)),
})<{
  slidePosition?: 'right' | 'bottom' | 'left';
}>`
  position: fixed;

  top: ${space(2)};
  right: 0;
  bottom: ${space(2)};
  left: ${space(2)};

  overflow: auto;
  pointer-events: auto;
  overscroll-behavior: contain;

  z-index: ${p => p.theme.zIndex.modal - 1};

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
        : p.slidePosition === 'right'
          ? css`
              position: fixed;

              width: ${PANEL_WIDTH};
              height: 100%;

              top: 0;
              right: 0;
              bottom: 0;
              left: auto;
            `
          : css`
              position: relative;

              width: ${PANEL_WIDTH};
              height: 100%;

              top: 0;
              right: auto;
              bottom: 0;
              left: auto;
            `}
  }
`;
