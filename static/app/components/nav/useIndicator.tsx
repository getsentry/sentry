import type {HTMLAttributes, PointerEvent} from 'react';
import {useRef, useState} from 'react';
import {useFocusWithin, useHover} from '@react-aria/interactions';

export interface IndicatorResult {
  containerProps: HTMLAttributes<HTMLUListElement>;
  indicatorProps: HTMLAttributes<HTMLSpanElement>;
}

export function useIndicator() {
  const hover = useRef<HTMLAnchorElement | null>(null);
  const animation = useRef<any>({type: 'inertia', velocity: 50});
  const [y, setY] = useState(0);
  const {isHovered, hoverProps} = useHover({});
  const {focusWithinProps} = useFocusWithin({});
  const handlePointerMove = (e: PointerEvent<HTMLUListElement>) => {
    if (!(e.target instanceof Element)) return;
    const a = e.target.closest('a');
    const list = e.target.closest('ul');
    if (!(a && list)) {
      hover.current = null;
      animation.current = {duration: 0.01};
      return;
    }
    if (hover.current === a) return;
    animation.current = {type: 'spring', mass: 0.1, damping: 10, stiffness: 150};
    hover.current = a;
    const newY = a?.getBoundingClientRect()?.y ?? 0;
    const offset = list.getBoundingClientRect()?.y ?? 0;
    setY(newY - offset);
  };

  return {
    containerProps: {
      ...hoverProps,
      ...focusWithinProps,
      onPointerMove: handlePointerMove,
    },
    indicatorProps: {
      role: 'presentation',
      animate: {y, opacity: isHovered ? 1 : 0},
      transition: {y: animation.current, opacity: {duration: 0.1}},
    },
  };
}
