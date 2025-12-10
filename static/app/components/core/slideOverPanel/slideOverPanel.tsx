import {useCallback, useDeferredValue, useEffect} from 'react';
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

interface ChildRenderProps {
  isOpening: boolean;
}

type ChildRenderFunction = (renderPropProps: ChildRenderProps) => React.ReactNode;

type SlideOverPanelProps = {
  children: React.ReactNode | ChildRenderFunction;
  /**
   * Whether the panel is visible. In most cases it's better to use this prop rather than render the panel conditionally, since it'll defer rendering the contents of the panel to a lower priority React lane.
   */
  open: boolean;
  ariaLabel?: string;
  className?: string;
  'data-test-id'?: string;
  /**
   * Callback that fires every time the panel opens.
   */
  onOpen?: () => void;
  panelWidth?: string;
  position?: 'right' | 'bottom' | 'left';
  ref?: React.Ref<HTMLDivElement>;
  /**
   * A Framer Motion `Transition` object that specifies the transition properties that apply when the panel opens and closes.
   */
  transitionProps?: Transition;
};

export function SlideOverPanel({
  'data-test-id': testId,
  ariaLabel,
  open: isOpen,
  children,
  className,
  onOpen,
  position,
  transitionProps = {},
  panelWidth,
  ref,
}: SlideOverPanelProps) {
  const theme = useTheme();

  // Create a deferred version of `isOpen`. Here's how the rendering flow works
  // when the visibility changes to `true`:
  //
  // 1. Parent component sets `isOpen` to `true`. This triggers a render.
  // 2. The render runs with `isOpen` `true` and `isContentVisible` `false`. We
  // pass `isOpening: true` to the `children` render prop. The render prop
  // contents should render a fast skeleton.
  // 3. The next render runs, with `isOpen` `true` and `isContentVisible`
  // `true`. This render is scheduled in the "transition" React lane. When this
  // is done, we pass `isOpening: false` to the children, and the render prop
  // should render the full UI. React periodically polls the main thread and
  // interrupt rendering of the full UI it if a high-priority render comes in.
  // Other state transitions are simpler, because we _only_ show the skeleton
  // during that "opening" transition.
  const isContentVisible = useDeferredValue(isOpen);

  useEffect(() => {
    if (isOpen && onOpen) {
      onOpen();
    }
  }, [isOpen, onOpen]);

  // Create a fallback render function, in case the parent component passes
  // `React.ReactNode` as `children`. This way, even if they don't pass a render
  // prop they still get the benefit of fast panel opening.
  const fallbackRenderFunction = useCallback<ChildRenderFunction>(
    ({isOpening}: ChildRenderProps) => {
      return isOpening ? null : (children as React.ReactNode); // This function should only ever run for `React.ReactNode`, its whole purpose is to create a render function for `React.ReactNode`
    },
    [children]
  );

  const renderFunctionProps: ChildRenderProps = {
    isOpening: isOpen !== isContentVisible && !isContentVisible,
  };

  const openStyle = position ? OPEN_STYLES[position] : OPEN_STYLES.right;

  const collapsedStyle = position ? COLLAPSED_STYLES[position] : COLLAPSED_STYLES.right;

  return isOpen ? (
    <_SlideOverPanel
      ref={ref}
      initial={collapsedStyle}
      animate={openStyle}
      exit={collapsedStyle}
      position={position}
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
      {/* Render the child content. If it's a render prop, pass the `isOpening`
      prop. We expect the render prop to render a skeleton UI if `isOpening` is
      true. Otherwise, use the fallback render prop, which shows a blank panel
      while opening. */}
      {typeof children === 'function'
        ? children(renderFunctionProps)
        : fallbackRenderFunction(renderFunctionProps)}
    </_SlideOverPanel>
  ) : null;
}

const _SlideOverPanel = styled(motion.div, {
  shouldForwardProp: prop =>
    ['initial', 'animate', 'exit', 'transition'].includes(prop) ||
    (prop !== 'isOpen' && isPropValid(prop)),
})<{
  panelWidth?: string;
  position?: 'right' | 'bottom' | 'left';
}>`
  position: fixed;

  top: ${p => (p.position === 'left' ? '54px' : space(2))};
  right: ${p => (p.position === 'left' ? space(2) : 0)};
  bottom: ${space(2)};
  left: ${p => (p.position === 'left' ? 0 : space(2))};

  overflow: auto;
  pointer-events: auto;
  overscroll-behavior: contain;

  z-index: ${p => p.theme.zIndex.modal - 1};

  box-shadow: ${p => (p.theme.isChonk ? undefined : p.theme.dropShadowHeavy)};
  background: ${p => p.theme.background};
  color: ${p => p.theme.tokens.content.primary};

  text-align: left;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    ${p =>
      p.position === 'bottom'
        ? css`
            position: sticky;

            width: 100%;
            height: ${PANEL_HEIGHT};

            right: 0;
            bottom: 0;
            left: 0;
          `
        : p.position === 'right'
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
