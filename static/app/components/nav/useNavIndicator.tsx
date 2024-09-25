import {
  type ComponentProps,
  type HTMLAttributes,
  type PointerEvent,
  useCallback,
} from 'react';
import {useFocusWithin, useHover} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import {type motion, useMotionValue, useReducedMotion, useSpring} from 'framer-motion';

export interface IndicatorResult {
  containerProps: HTMLAttributes<HTMLUListElement>;
  indicatorProps: ComponentProps<typeof motion.span>;
}

export function useNavIndicator(): IndicatorResult {
  const prefersReducedMotion = useReducedMotion();
  const ty = useMotionValue(0);
  const y = useSpring(
    ty,
    prefersReducedMotion
      ? {duration: 0}
      : {
          mass: 0.5,
          damping: 15,
          stiffness: 200,
          restDelta: 0.05,
        }
  );
  const {isHovered, hoverProps} = useHover({});
  const {focusWithinProps} = useFocusWithin({});

  const handlePointerMove = useCallback(
    (e: PointerEvent<HTMLUListElement>) => {
      if (e.target instanceof HTMLAnchorElement) {
        ty.set(e.target.offsetTop);
        return;
      }
    },
    [ty]
  );

  const handlePointerEnter = useCallback(
    (e: PointerEvent<HTMLUListElement>) => {
      if (e.target instanceof HTMLUListElement) {
        y.jump(e.target.querySelector('a')!.offsetTop);
      } else if (e.target instanceof HTMLElement) {
        y.jump(e.target.offsetTop);
      }
    },
    [y]
  );

  return {
    containerProps: mergeProps(hoverProps, focusWithinProps, {
      onPointerEnter: handlePointerEnter,
      onPointerMove: handlePointerMove,
    }),
    indicatorProps: {
      'aria-hidden': 'true',
      style: {y},
      animate: {opacity: isHovered ? 1 : 0},
      transition: {duration: 0.2},
    },
  };
}
