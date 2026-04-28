import {useCallback, useEffect, useRef} from 'react';

type MouseMovementData = {
  horizontalDirection: number;
  horizontalSpeed: number;
  verticalDirection: number;
  verticalSpeed: number;
  x: number;
  y: number;
};

/**
 * Tracks mouse movement data (coordinates, speed, direction) for a given element.
 */
export const useMouseMovement = ({
  ref,
  disabled,
}: {
  ref: React.RefObject<HTMLElement | null>;
  disabled?: boolean;
}): React.RefObject<MouseMovementData> => {
  const mouseMovementDataRef = useRef<MouseMovementData>({
    x: 0,
    y: 0,
    verticalSpeed: 0,
    horizontalSpeed: 0,
    verticalDirection: 0,
    horizontalDirection: 0,
  });

  const mouseRef = useRef<{
    currentEvent: MouseEvent | null;
    prevEvent: MouseEvent | null;
  }>({
    prevEvent: null,
    currentEvent: null,
  });

  const rafRef = useRef<number>(0);
  const lastTimestampRef = useRef<number>(0);
  const isCalculating = useRef<boolean>(false);

  const reset = useCallback(() => {
    mouseRef.current = {
      prevEvent: null,
      currentEvent: null,
    };
    lastTimestampRef.current = 0;
    isCalculating.current = false;
    mouseMovementDataRef.current = {
      x: 0,
      y: 0,
      verticalSpeed: 0,
      horizontalSpeed: 0,
      verticalDirection: 0,
      horizontalDirection: 0,
    };
  }, []);

  const calculateMouseMetrics = useCallback((timestamp: number): void => {
    if (!mouseRef.current.prevEvent || !mouseRef.current.currentEvent) {
      mouseRef.current.prevEvent = mouseRef.current.currentEvent;
      return;
    }

    const timeDiff = timestamp - lastTimestampRef.current;

    if (timeDiff <= 0) {
      return;
    }

    const e = mouseRef.current.currentEvent;
    const timeDiffSeconds = timeDiff / 1000;

    const offsetX = e.clientX - mouseRef.current.prevEvent.clientX;
    const offsetY = e.clientY - mouseRef.current.prevEvent.clientY;

    const movementX = Math.abs(offsetX);
    const movementY = Math.abs(offsetY);

    const verticalSpeed = movementY / timeDiffSeconds;
    const horizontalSpeed = movementX / timeDiffSeconds;

    const metrics: MouseMovementData = {
      x: e.clientX,
      y: e.clientY,
      verticalSpeed,
      horizontalSpeed,
      verticalDirection: Math.sign(offsetY),
      horizontalDirection: Math.sign(offsetX),
    };

    lastTimestampRef.current = timestamp;
    mouseMovementDataRef.current = metrics;
    mouseRef.current.prevEvent = mouseRef.current.currentEvent;
  }, []);

  useEffect(() => {
    const startMouseCalculation = (): void => {
      const step = (timestamp: number): void => {
        if (isCalculating.current) {
          return;
        }

        isCalculating.current = true;
        calculateMouseMetrics(timestamp);
        isCalculating.current = false;
      };

      rafRef.current = requestAnimationFrame(step);
    };

    const handleMouseMove = (e: MouseEvent): void => {
      mouseRef.current.currentEvent = e;
      startMouseCalculation();
    };

    const handleMouseEnter = (e: MouseEvent): void => {
      reset();
      mouseRef.current.currentEvent = e;
      startMouseCalculation();
    };

    const el = ref.current;

    if (!el || disabled) {
      return () => {};
    }

    el.addEventListener('mouseenter', handleMouseEnter);
    el.addEventListener('mousemove', handleMouseMove);

    return () => {
      el.removeEventListener('mouseenter', handleMouseEnter);
      el.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [calculateMouseMetrics, ref, disabled, reset]);

  return mouseMovementDataRef;
};
