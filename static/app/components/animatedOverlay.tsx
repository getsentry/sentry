import {forwardRef} from 'react';
import {SerializedStyles} from '@emotion/react';
import styled from '@emotion/styled';
import {PlacementAxis} from '@react-types/overlays';
import {HTMLMotionProps, motion, MotionProps, MotionStyle} from 'framer-motion';

import testableTransition from 'sentry/utils/testableTransition';

interface AnimatedOverlayProps extends HTMLMotionProps<'div'> {
  /**
   * Indicates where the overlay is placed. This is useful for the animation to
   * be animated 'towards' the placment origin, giving it a pleasing effect.
   */
  placement: PlacementAxis | undefined;
  /**
   * The CSS styles for the "origin point" over the overlay. Typically this
   * would be the arrow (or tip).
   */
  originPointCss?: React.CSSProperties;
  /**
   * Additional style rules for the overlay content.
   */
  overlayStyle?: React.CSSProperties | SerializedStyles;
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
  placement?: PlacementAxis,
  originPointCss?: React.CSSProperties
): MotionStyle {
  const {top, left} = originPointCss ?? {};

  // XXX: Bottom means the arrow will be pointing up.
  switch (placement) {
    case 'top':
      return {originX: left ? `${left}px` : '50%', originY: '100%'};
    case 'bottom':
      return {originX: left ? `${left}px` : '50%', originY: 0};
    case 'left':
      return {originX: '100%', originY: top ? `${top}px` : '50%'};
    case 'right':
      return {originX: 0, originY: top ? `${top}px` : '50%'};
    default:
      return {originX: `50%`, originY: '50%'};
  }
}

/**
 * A overlay component that has a nice ease in animation along with a
 * scale-down animation that animates towards an origin (think a tooltip
 * pointing at something).
 *
 * Should be used within a `<AnimatePresence />`.
 */
const AnimatedOverlay = styled(
  ({
    placement,
    originPointCss,
    style,
    overlayStyle: _overlayStyle,
    ...props
  }: AnimatedOverlayProps) => (
    <motion.div
      style={{
        ...style,
        ...computeOriginFromArrow(placement, originPointCss),
      }}
      {...overlayAnimation}
      {...props}
    />
  )
)`
  will-change: transform, opacity;
  ${p => p.overlayStyle as any};
`;

interface PositionWrapperProps extends React.HTMLAttributes<HTMLDivElement> {
  /**
   * Determines the zindex over the position wrapper
   */
  zIndex: number;
}

/**
 * The PositionWrapper may be used when you're using the AnimatedOverlay as
 * part of dynamically positioned component (useOverlayPosition).
 *
 * This component ensures the wrapped AnimatedOverlay will not receive pointer
 * events while it is being animated out.
 */
const PositionWrapper = forwardRef<HTMLDivElement, PositionWrapperProps>(
  (
    {
      // XXX: Some of framer motions props are incompatible with
      // HTMLAttributes<HTMLDivElement>. Due to the way useOverlayPosition uses
      // this component it must be compatible with that type.
      onAnimationStart: _onAnimationStart,
      onDragStart: _onDragStart,
      onDragEnd: _onDragEnd,
      onDrag: _onDrag,
      zIndex,
      style,
      ...props
    },
    ref
  ) => (
    <motion.div
      {...props}
      ref={ref}
      style={{...style, zIndex}}
      initial={{pointerEvents: 'auto'}}
      exit={{pointerEvents: 'none'}}
    />
  )
);

export {AnimatedOverlay, PositionWrapper};
