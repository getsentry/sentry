import {useDeferredValue, useEffect} from 'react';
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
  collapsed: boolean;
  ariaLabel?: string;
  className?: string;
  'data-test-id'?: string;
  /**
   * Callback that fires every time the panel opens.
   */
  onOpen?: () => void;
  panelWidth?: string;
  ref?: React.Ref<HTMLDivElement>;
  /**
   * Placeholder UI to show while the contents of the panel are rendering. If supplied, this UI will be shown inside the panel, and the real contents of the panel will render in a separate step. Highly recommended if the contents of the panel take > 200ms to render.
   */
  skeleton?: React.ReactNode;
  slidePosition?: 'right' | 'bottom' | 'left';
  /**
   * A Framer Motion `Transition` object that specifies the transition properties that apply when the panel opens and closes.
   */
  transitionProps?: Transition;
};

export function SlideOverPanel({
  'data-test-id': testId,
  ariaLabel,
  collapsed,
  children,
  className,
  onOpen,
  slidePosition,
  transitionProps = {},
  panelWidth,
  skeleton,
  ref,
}: SlideOverPanelProps) {
  const theme = useTheme();

  const isOpen = !collapsed;

  // Create a deferred version of `isOpen`. Here's how the rendering flow works
  // when the visibility changes to `true`.
  //
  // 1. Parent component sets `collapsed` to `false`. This triggers a render.
  // 2. The render runs with `isOpen` `true` and `isContentVisible` `false`.
  // This render is very fast, because when the states are mismatched and there
  // is a skeleton available, and the content is not yet visible, we render the
  // skeleton which is cheap. `useDeferredValue` schedules another render, with
  // `isContentVisible` set to `true`
  // 3. The next render runs, with `isOpen` `true` and `isContentVisible`
  // `true`. This render is scheduled in the "transition" React lane. When this
  // is done, we render the children!
  // Other state transitions are simpler, because we _only_ show the skeleton
  // during that "opening" transition. In all other situations we show the
  // children.
  const isContentVisible = useDeferredValue(isOpen);

  useEffect(() => {
    if (!collapsed && onOpen) {
      onOpen();
    }
  }, [collapsed, onOpen]);

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
      aria-hidden={collapsed}
      aria-label={ariaLabel ?? 'slide out drawer'}
      className={className}
      data-test-id={testId}
      panelWidth={panelWidth}
    >
      {/* See note above for an explanation of how this works. */}
      {isOpen !== isContentVisible && !isContentVisible && skeleton ? skeleton : children}
    </_SlideOverPanel>
  ) : null;
}

const _SlideOverPanel = styled(motion.div, {
  shouldForwardProp: prop =>
    ['initial', 'animate', 'exit', 'transition'].includes(prop) ||
    (prop !== 'collapsed' && isPropValid(prop)),
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
