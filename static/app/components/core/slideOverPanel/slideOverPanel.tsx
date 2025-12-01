import {useEffect} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion, type Transition} from 'framer-motion';

import {space} from 'sentry/styles/space';

const RIGHT_SIDE_PANEL_WIDTH = '50vw';
const LEFT_SIDE_PANEL_WIDTH = '40vw';
const PANEL_HEIGHT = '50vh';

const OPEN_STYLES = {
  bottom: {transform: 'translateX(0) translateY(0)', opacity: 1},
  right: {transform: 'translateX(0) translateY(0)', opacity: 1},
  left: {transform: 'translateX(0) translateY(0)', opacity: 1},
};

const COLLAPSED_STYLES = {
  bottom: {transform: `translateX(0) translateY(${PANEL_HEIGHT})`, opacity: 0},
  right: {transform: `translateX(${RIGHT_SIDE_PANEL_WIDTH}) translateY(0)`, opacity: 0},
  left: {transform: `translateX(-${LEFT_SIDE_PANEL_WIDTH}) translateY(0)`, opacity: 0},
};

type SlideOverPanelProps = {
  children: React.ReactNode;
  /**
   * Whether the panel is visible. In most cases it's better to conditionally render this component rather than use this prop, since it'll defer rendering the panel contents until they're needed.
   */
  isOpen: boolean;
  ariaLabel?: string;
  className?: string;
  'data-test-id'?: string;
  /**
   * Callback that fires every time the panel opens.
   */
  onOpen?: () => void;
  panelWidth?: string;
  ref?: React.Ref<HTMLDivElement>;
  slidePosition?: 'right' | 'bottom' | 'left';
  /**
   * A Framer Motion `Transition` object that specifies the transition properties that apply when the panel opens and closes.
   */
  transitionProps?: Transition;
};

export function SlideOverPanel({
  'data-test-id': testId,
  ariaLabel,
  isOpen,
  children,
  className,
  onOpen,
  slidePosition,
  transitionProps = {},
  panelWidth,
  ref,
}: SlideOverPanelProps) {
  const theme = useTheme();

  useEffect(() => {
    if (isOpen && onOpen) {
      onOpen();
    }
  }, [isOpen, onOpen]);

  const openStyle = slidePosition ? OPEN_STYLES[slidePosition] : OPEN_STYLES.right;

  const collapsedStyle = slidePosition
    ? COLLAPSED_STYLES[slidePosition]
    : COLLAPSED_STYLES.right;

  return isOpen ? (
    <_SlideOverPanel
      ref={ref}
      initial={collapsedStyle}
      animate={openStyle}
      exit={collapsedStyle}
      slidePosition={slidePosition}
      transition={{
        ...theme.motion.framer.spring.moderate,
        ...transitionProps,
      }}
      role="complementary"
      aria-hidden={!isOpen}
      aria-label={ariaLabel ?? 'slide out drawer'}
      className={className}
      data-test-id={testId}
      panelWidth={panelWidth}
    >
      {children}
    </_SlideOverPanel>
  ) : null;
}

const _SlideOverPanel = styled(motion.div, {
  shouldForwardProp: prop =>
    ['initial', 'animate', 'exit', 'transition'].includes(prop) ||
    (prop !== 'isOpen' && isPropValid(prop)),
})<{
  panelWidth?: string;
  slidePosition?: 'right' | 'bottom' | 'left';
}>`
  position: fixed;

  top: ${p => (p.slidePosition === 'left' ? '54px' : space(2))};
  right: ${p => (p.slidePosition === 'left' ? space(2) : 0)};
  bottom: ${space(2)};
  left: ${p => (p.slidePosition === 'left' ? 0 : space(2))};

  overflow: auto;
  pointer-events: auto;
  overscroll-behavior: contain;

  z-index: ${p => p.theme.zIndex.modal - 1};

  box-shadow: ${p => (p.theme.isChonk ? undefined : p.theme.dropShadowHeavy)};
  background: ${p => p.theme.background};
  color: ${p => p.theme.textColor};

  text-align: left;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
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

              width: ${p.panelWidth ?? RIGHT_SIDE_PANEL_WIDTH};
              height: 100%;

              top: 0;
              right: 0;
              bottom: 0;
              left: auto;
            `
          : css`
              position: relative;

              width: ${p.panelWidth ?? LEFT_SIDE_PANEL_WIDTH};
              min-width: 450px;
              height: 100%;

              top: 0;
              right: auto;
              bottom: 0;
              left: auto;
            `}
  }
`;
