import {forwardRef} from 'react';
import type {PopperProps} from 'react-popper';
import type {SerializedStyles} from '@emotion/react';
import styled from '@emotion/styled';
import type {HTMLMotionProps, MotionProps, MotionStyle} from 'framer-motion';
import {motion, useIsPresent} from 'framer-motion';

import type {OverlayArrowProps} from 'sentry/components/overlayArrow';
import {OverlayArrow} from 'sentry/components/overlayArrow';
import {NODE_ENV} from 'sentry/constants';
import {defined} from 'sentry/utils';
import PanelProvider from 'sentry/utils/panelProvider';
import testableTransition from 'sentry/utils/testableTransition';

type OriginPoint = Partial<{x: number; y: number}>;

interface OverlayProps extends HTMLMotionProps<'div'> {
  /**
   * Whether the overlay should animate in/out. If true, we'll also need
   * the `placement` and `originPoint` props.
   */
  animated?: boolean;
  /**
   * Props to be passed into <OverlayArrow />. If undefined, the overlay will
   * render with no arrow.
   */
  arrowProps?: OverlayArrowProps;
  children?: React.ReactNode;
  /**
   * The CSS styles for the "origin point" over the overlay. Typically this
   * would be the arrow (or tip).
   */
  originPoint?: OriginPoint;
  /**
   * Additional style rules for the overlay content.
   */
  overlayStyle?: React.CSSProperties | SerializedStyles;
  /**
   * Indicates where the overlay is placed. This is useful for the animation to
   * be animated 'towards' the placment origin, giving it a pleasing effect.
   */
  placement?: PopperProps<any>['placement'];
}

const overlayAnimation: MotionProps = {
  transition: {duration: 0.2},
  initial: {opacity: 0},
  animate: {
    opacity: 1,
    scale: 1,
    transition: testableTransition({
      type: 'linear',
      ease: [0.5, 1, 0.89, 1],
      duration: 0.2,
    }),
  },
  exit: {
    opacity: 0,
    scale: 0.95,
    transition: testableTransition({type: 'spring', delay: 0.1}),
  },
};

/**
 * Used to compute the transform origin to give the scale-down micro-animation
 * a pleasant feeling. Without this the animation can feel somewhat 'wrong'
 * since the direction of the scale isn't towards the reference element
 */
function computeOriginFromArrow(
  placement?: PopperProps<any>['placement'],
  originPoint?: OriginPoint
): MotionStyle {
  const simplePlacement = placement?.split('-')[0];
  const {y, x} = originPoint ?? {};

  // XXX: Bottom means the arrow will be pointing up.
  switch (simplePlacement) {
    case 'top':
      return {originX: x ? `${x}px` : '50%', originY: '100%'};
    case 'bottom':
      return {originX: x ? `${x}px` : '50%', originY: 0};
    case 'left':
      return {originX: '100%', originY: y ? `${y}px` : '50%'};
    case 'right':
      return {originX: 0, originY: y ? `${y}px` : '50%'};
    default:
      return {originX: `50%`, originY: '50%'};
  }
}

/**
 * A overlay component that has an optional nice ease in animation along with
 * a scale-down animation that animates towards an origin (think a tooltip
 * pointing at something).
 *
 * If animated (`animated` prop is true), should be used within a
 * `<AnimatePresence />`.
 */
const Overlay = styled(
  forwardRef<HTMLDivElement, OverlayProps>(
    (
      {
        children,
        arrowProps,
        animated,
        placement,
        originPoint,
        style,
        overlayStyle: _overlayStyle,
        ...props
      },
      ref
    ) => {
      const isTestEnv = NODE_ENV === 'test';
      const animationProps =
        !isTestEnv && animated
          ? {
              ...overlayAnimation,
              style: {
                ...style,
                ...computeOriginFromArrow(placement, originPoint),
              },
            }
          : {style};

      return (
        <motion.div {...props} {...animationProps} data-overlay ref={ref}>
          {defined(arrowProps) && <OverlayArrow {...arrowProps} />}
          <PanelProvider>{children}</PanelProvider>
        </motion.div>
      );
    }
  )
)`
  position: relative;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => p.theme.backgroundElevated};
  box-shadow:
    0 0 0 1px ${p => p.theme.translucentBorder},
    ${p => p.theme.dropShadowHeavy};
  font-size: ${p => p.theme.fontSizeMedium};

  /* Override z-index from useOverlayPosition */
  z-index: ${p => p.theme.zIndex.dropdown} !important;
  ${p => p.animated && `will-change: transform, opacity;`}

  /* Specificity hack to allow override styles to have higher specificity than
   * styles provided in any styled components which extend Overlay */
  :where(*) {
    ${p => p.overlayStyle as any}
  }
`;

interface PositionWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Determines the zindex over the position wrapper
   */
  zIndex: number;
}

/**
 * The PositionWrapper should be used when you're using the AnimatedOverlay as
 * part of dynamically positioned component (useOverlayPosition). Generally
 * this component will receive the `overlayProps`.
 *
 * This component ensures the wrapped AnimatedOverlay will not receive pointer
 * events while it is being animated out. Especially useful since the
 * `overlayProps` includes a onMouseEnter to allow the overlay to be hovered,
 * which we would not want while its fading away.
 */
const PositionWrapper = forwardRef<HTMLDivElement, PositionWrapperProps>(
  // XXX(epurkhiser): This is a motion.div NOT because it is animating, but
  // because we need the context of the animation starting for applying the
  // `pointerEvents: none`.
  (
    {
      // XXX: Some of framer motions props are incompatible with
      // HTMLAttributes<HTMLDivElement>. Due to the way useOverlay uses this
      // component it must be compatible with that type.
      onAnimationStart: _onAnimationStart,
      onDragStart: _onDragStart,
      onDragEnd: _onDragEnd,
      onDrag: _onDrag,
      zIndex,
      style,
      ...props
    },
    ref
  ) => {
    const isPresent = useIsPresent();
    return (
      <motion.div
        {...props}
        ref={ref}
        style={{...style, zIndex, pointerEvents: isPresent ? 'auto' : 'none'}}
      />
    );
  }
);

export {Overlay, PositionWrapper};
