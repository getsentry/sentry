import {forwardRef} from 'react';
import {PopperProps} from 'react-popper';
import {SerializedStyles} from '@emotion/react';
import styled from '@emotion/styled';
import {HTMLMotionProps, motion, MotionProps, MotionStyle} from 'framer-motion';

import OverlayArrow from 'sentry/components/overlayArrow';
import space from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';
import {Theme} from 'sentry/utils/theme';

type OriginPoint = Partial<{x: number; y: number}>;

interface OverlayProps {
  /**
   * Props to be passed into <OverlayArrow />
   */
  arrowProps?: React.ComponentProps<typeof OverlayArrow>;
  children?: React.ReactNode;
  /**
   * Additional style rules for the overlay content.
   */
  overlayStyle?: React.CSSProperties | SerializedStyles;
  /**
   * Whether to display an arrow. If true, `arrowProps` is also needed to
   * correctly position and orient the arrow.
   */
  showArrow?: boolean;
}

interface AnimatedOverlayProps extends OverlayProps, HTMLMotionProps<'div'> {
  /**
   * Indicates where the overlay is placed. This is useful for the animation to
   * be animated 'towards' the placment origin, giving it a pleasing effect.
   */
  placement: PopperProps<any>['placement'];
  /**
   * The CSS styles for the "origin point" over the overlay. Typically this
   * would be the arrow (or tip).
   */
  originPoint?: OriginPoint;
}

function getOverlayStyles({theme}: {theme: Theme}) {
  return `
    max-width: 24rem;
    position: relative;
    border-radius: ${theme.borderRadius};
    background: ${theme.backgroundElevated};
    box-shadow: 0 0 0 1px ${theme.translucentBorder}, ${theme.dropShadowHeavy};
    font-size: ${theme.fontSizeMedium};

    margin: ${space(1)} 0;

    /* Override z-index from useOverlayPosition */
    z-index: ${theme.zIndex.dropdown} !important;
  `;
}

/**
 * An overlay component that renders with an optional arrow. If the overlay
 * needs to be animated, use AnimatedOverlay instead.
 */
const Overlay = styled(
  ({
    children,
    overlayStyle: _overlayStyle,
    showArrow,
    arrowProps,
    ...props
  }: OverlayProps) => (
    <div {...props}>
      {showArrow && <OverlayArrow {...arrowProps} />}
      {children}
    </div>
  )
)`
  ${getOverlayStyles};
  ${p => p.overlayStyle as any};
`;

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
 * A overlay component that has a nice ease in animation along with a
 * scale-down animation that animates towards an origin (think a tooltip
 * pointing at something).
 *
 * Should be used within a `<AnimatePresence />`.
 */
const AnimatedOverlay = styled(
  ({
    children,
    placement,
    originPoint,
    style,
    overlayStyle: _overlayStyle,
    showArrow,
    arrowProps,
    ...props
  }: AnimatedOverlayProps) => (
    <motion.div
      style={{
        ...style,
        ...computeOriginFromArrow(placement, originPoint),
      }}
      {...overlayAnimation}
      {...props}
    >
      {showArrow && <OverlayArrow {...arrowProps} />}
      {children}
    </motion.div>
  )
)`
  will-change: transform, opacity;
  ${getOverlayStyles};
  ${p => p.overlayStyle as any};
`;

interface PositionWrapperProps extends HTMLMotionProps<'div'> {
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
  ({zIndex, style, ...props}, ref) => (
    <motion.div
      {...props}
      ref={ref}
      style={{...style, zIndex}}
      initial={{pointerEvents: 'auto'}}
      exit={{pointerEvents: 'none'}}
    />
  )
);

export {Overlay, AnimatedOverlay, PositionWrapper};
