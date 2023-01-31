import {MouseEventHandler, useState} from 'react';

import {defined} from 'sentry/utils';

type UseMousePanProps = {
  initialXOffset: number;
  initialYOffset: number;
};

export function useMousePan({initialXOffset, initialYOffset}: UseMousePanProps) {
  const [dragStartCoords, setDragStartCoords] = useState<{x: number; y: number} | null>(
    null
  );
  const [xOffset, setXOffset] = useState(initialXOffset);
  const [yOffset, setYOffset] = useState(initialYOffset);

  const handlePanStart: MouseEventHandler<HTMLCanvasElement> = e => {
    e.preventDefault();
    e.stopPropagation();

    setDragStartCoords({
      x: e.clientX - xOffset,
      y: e.clientY - yOffset,
    });
  };

  const handlePanStop: MouseEventHandler<HTMLCanvasElement> = e => {
    e.preventDefault();
    e.stopPropagation();

    setDragStartCoords(null);
  };

  const handlePanMove: MouseEventHandler<HTMLCanvasElement> = e => {
    if (!defined(dragStartCoords)) {
      return;
    }

    const {x, y} = dragStartCoords;

    e.preventDefault();
    e.stopPropagation();

    const mouseX = e.clientX - xOffset;
    const mouseY = e.clientY - yOffset;

    const dx = mouseX - x;
    const dy = mouseY - y;

    setXOffset(xOffset + dx);
    setYOffset(yOffset + dy);
  };

  return {
    handlePanStart,
    handlePanStop,
    handlePanMove,
    isDragging: defined(dragStartCoords),
    xOffset,
    yOffset,
  };
}
