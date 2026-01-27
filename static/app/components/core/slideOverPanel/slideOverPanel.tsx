import {useEffect, useId, useState, useTransition} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import {motion, type Transition} from 'framer-motion';

import {BoundaryContextProvider} from '@sentry/scraps/boundaryContext';
import {Surface, type ContainerProps} from '@sentry/scraps/layout';

import {unreachable} from 'sentry/utils/unreachable';

const MotionSurface = motion.create(Surface);

interface SlideOverPanelProps extends Pick<ContainerProps<'aside'>, 'width'> {
  children: React.ReactNode | ((props: {isOpening: boolean}) => React.ReactNode);
  placement: 'right' | 'bottom' | 'left';
  /**
   * A Framer Motion `Transition` object that specifies the transition properties that apply when the panel opens and closes.
   */
  transition?: Transition;
}

export function SlideOverPanel({children, ...props}: SlideOverPanelProps) {
  const theme = useTheme();

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
  const [isTransitioning, startTransition] = useTransition();
  const [isContentVisible, setIsContentVisible] = useState<boolean>(false);

  useEffect(() => {
    startTransition(() => {
      setIsContentVisible(true);
    });
  }, []);

  const isOpening = isTransitioning || !isContentVisible;

  const id = useId();
  return (
    <BoundaryContextProvider value={id}>
      <AnimatedSurface
        as="aside"
        id={id}
        initial={COLLAPSED_STYLES[props.placement]}
        animate={OPEN_STYLES[props.placement]}
        exit={COLLAPSED_STYLES[props.placement]}
        variant="primary"
        role="complementary"
        overflow="auto"
        pointerEvents="auto"
        overscrollBehavior="contain"
        position={props.placement === 'bottom' ? 'sticky' : 'fixed'}
        transition={{
          ...theme.motion.framer.spring.moderate,
          ...props.transition,
        }}
        {...props}
        {...getSlideoutPlacementStyles(props.placement, props.width, theme)}
      >
        {/* Render the child content. If it's a render prop, pass the `isOpening`
      prop. We expect the render prop to render a skeleton UI if `isOpening` is
      true. If `children` is not a render prop, render nothing while
      transitioning. */}
        {typeof children === 'function'
          ? children({isOpening})
          : isOpening
            ? null
            : children}
      </AnimatedSurface>
    </BoundaryContextProvider>
  );
}

function getSlideoutPlacementStyles(
  placement: 'right' | 'bottom' | 'left',
  theme: Theme
): Pick<
  ContainerProps,
  'position' | 'height' | 'width' | 'right' | 'top' | 'bottom' | 'left' | 'minWidth'
> {
  switch (placement) {
    case 'right':
      return {
        position: {'2xs': 'fixed', xs: 'fixed'},
        height: {'2xs': `calc(100vh - ${theme.space.lg})`, xs: '100%'},
        width: {'2xs': `calc(100vw - ${theme.space.lg})`, xs: RIGHT_SIDE_PANEL_WIDTH},
        right: 0,
        top: 0,
        bottom: 0,
      };
    case 'left':
      return {
        position: {'2xs': 'fixed', xs: 'relative'},
        width: LEFT_SIDE_PANEL_WIDTH,
        minWidth: '450px',
        height: '100%',
        left: 0,
        top: 0,
        bottom: 0,
      };
    case 'bottom':
      return {
        position: {'2xs': 'fixed', xs: 'sticky'},
        width: '100%',
        height: BOTTOM_SIDE_PANEL_HEIGHT,
        bottom: 0,
        left: 0,
        right: 0,
      };
    default:
      unreachable(placement);
      throw new Error(`Invalid placement: ${placement}`);
  }
}

const AnimatedSurface = styled(MotionSurface)<SlideOverPanelProps>`
  z-index: ${p => p.theme.zIndex.modal - 1};
`;

const RIGHT_SIDE_PANEL_WIDTH = '50vw';
const LEFT_SIDE_PANEL_WIDTH = '40vw';
const BOTTOM_SIDE_PANEL_HEIGHT = '50vh';

const OPEN_STYLES = {
  bottom: {transform: 'translateX(0) translateY(0)', opacity: 1},
  right: {transform: 'translateX(0) translateY(0)', opacity: 1},
  left: {transform: 'translateX(0) translateY(0)', opacity: 1},
};

const COLLAPSED_STYLES = {
  bottom: {
    transform: `translateX(0) translateY(${BOTTOM_SIDE_PANEL_HEIGHT})`,
    opacity: 0,
  },
  right: {transform: `translateX(${RIGHT_SIDE_PANEL_WIDTH}) translateY(0)`, opacity: 0},
  left: {transform: `translateX(-${LEFT_SIDE_PANEL_WIDTH}) translateY(0)`, opacity: 0},
};
