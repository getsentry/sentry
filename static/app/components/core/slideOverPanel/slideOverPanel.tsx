import {useEffect, useId, useState, useTransition} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion, type Transition} from 'framer-motion';

import {BoundaryContextProvider} from '@sentry/scraps/boundaryContext';

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
  ariaLabel?: string;
  className?: string;
  'data-test-id'?: string;
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
  children,
  className,
  position,
  transitionProps = {},
  panelWidth,
  ref,
}: SlideOverPanelProps) {
  const theme = useTheme();

  const [isTransitioning, startTransition] = useTransition();

  // Defer rendering the children on initial mount. Here's how the flow works:
  //
  // 1. On mount (the first render), `isContentVisible` is set to `false` and
  // `isTransitioning` set to `false`. We render the children and pass
  // `isOpening: true`. The children may choose to show a fast-to-render
  // skeleton UI, or nothing.
  // 2. Immediately after mount, `useEffect` runs and schedules a transition
  // that will update `isContentVisible` state to `true`.
  // 3. The "transition" starts. This component renders with `isContentVisible`
  // set to `false` but `isTransitioning` set to `true`, since the transition is
  // running.
  // 4. The transition makes the state update. This component re-renders with
  // `isTransitioning` set to `false` and `isContentVisible` set to `true`. We
  // render the children with `isOpening: false`. The children render their full
  // contents in a lower priority lane. When the render is complete, the content
  // is displayed.
  // Subsequent updates of the `children` are not deferred.
  const [isContentVisible, setIsContentVisible] = useState<boolean>(false);

  useEffect(() => {
    startTransition(() => {
      setIsContentVisible(true);
    });
  }, []);

  const id = useId();

  const renderFunctionProps: ChildRenderProps = {
    isOpening: isTransitioning || !isContentVisible,
  };

  const openStyle = position ? OPEN_STYLES[position] : OPEN_STYLES.right;

  const collapsedStyle = position ? COLLAPSED_STYLES[position] : COLLAPSED_STYLES.right;

  return (
    <BoundaryContextProvider value={id}>
      <_SlideOverPanel
        ref={ref}
        id={id}
        initial={collapsedStyle}
        animate={openStyle}
        exit={collapsedStyle}
        position={position}
        transition={{
          ...theme.motion.framer.spring.moderate,
          ...transitionProps,
        }}
        role="complementary"
        aria-hidden={false}
        aria-label={ariaLabel ?? 'slide out drawer'}
        className={className}
        data-test-id={testId}
        panelWidth={panelWidth}
      >
        {/* Render the child content. If it's a render prop, pass the `isOpening`
      prop. We expect the render prop to render a skeleton UI if `isOpening` is
      true. If `children` is not a render prop, render nothing while
      transitioning. */}
        {typeof children === 'function'
          ? children(renderFunctionProps)
          : renderFunctionProps.isOpening
            ? null
            : children}
      </_SlideOverPanel>
    </BoundaryContextProvider>
  );
}

const _SlideOverPanel = styled(motion.div, {
  shouldForwardProp: prop =>
    ['initial', 'animate', 'exit', 'transition'].includes(prop) || isPropValid(prop),
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

  background: ${p => p.theme.tokens.background.primary};
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
