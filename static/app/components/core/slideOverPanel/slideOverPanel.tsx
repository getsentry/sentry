import {useEffect, useId, useState, useTransition} from 'react';
import {useTheme, type Theme} from '@emotion/react';
import {motion} from 'framer-motion';

import {BoundaryContextProvider} from '@sentry/scraps/boundaryContext';
import {Surface, type ContainerProps} from '@sentry/scraps/layout';
import {isResponsive} from '@sentry/scraps/layout/styles';

import {unreachable} from 'sentry/utils/unreachable';

const MotionSurface = motion.create(Surface);

interface SlideOverPanelProps
  extends Omit<React.ComponentProps<typeof MotionSurface>, 'children' | 'transition'> {
  children: React.ReactNode | ((props: {isOpening: boolean}) => React.ReactNode);
  placement: 'right' | 'left';
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
      <MotionSurface
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
        transition={theme.motion.framer.spring.moderate}
        // Polymorphism is not very well supported by emotion and in this case conflicts with the
        // HTMLMotionProps type on the onAnimationStart and onDrag members.
        {...(props as any)}
        {...getSlideoutPlacementStyles(
          {placement: props.placement, width: props.width},
          theme
        )}
        style={{zIndex: theme.zIndex.drawer}}
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
      </MotionSurface>
    </BoundaryContextProvider>
  );
}

function getSlideoutPlacementStyles(
  props: Pick<SlideOverPanelProps, 'placement' | 'width'>,
  theme: Theme
): ContainerProps {
  switch (props.placement) {
    case 'right':
      return {
        position: 'fixed',
        height: {'2xs': `calc(100vh - ${theme.space.lg})`, sm: '100%'},
        width: isResponsive(props.width)
          ? props.width
          : {
              '2xs': `calc(100vw - ${theme.space.lg})`,
              sm: props.width ?? RIGHT_SIDE_PANEL_WIDTH,
            },
        right: 0,
        top: {'2xs': theme.space.md, sm: 0},
        bottom: {'2xs': theme.space.md, sm: 0},
      };
    case 'left':
      return {
        position: {'2xs': 'fixed', sm: 'relative'},
        width: isResponsive(props.width)
          ? (props.width ?? LEFT_SIDE_PANEL_WIDTH)
          : {
              '2xs': `calc(100vw - ${theme.space.lg})`,
              sm: props.width ?? LEFT_SIDE_PANEL_WIDTH,
            },
        minWidth: '450px',
        height: '100%',
        left: 0,
        top: {'2xs': '54px', sm: 0},
        bottom: {'2xs': theme.space.md, sm: 0},
      };
    default:
      unreachable(props.placement);
      throw new Error(`Invalid placement: ${props.placement}`);
  }
}

const RIGHT_SIDE_PANEL_WIDTH = '50vw';
const LEFT_SIDE_PANEL_WIDTH = '40vw';

const OPEN_STYLES = {
  right: {transform: 'translateX(0) translateY(0)', opacity: 1},
  left: {transform: 'translateX(0) translateY(0)', opacity: 1},
};

const COLLAPSED_STYLES = {
  right: {transform: `translateX(${RIGHT_SIDE_PANEL_WIDTH}) translateY(0)`, opacity: 0},
  left: {transform: `translateX(-${LEFT_SIDE_PANEL_WIDTH}) translateY(0)`, opacity: 0},
};
