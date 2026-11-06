import type * as React from 'react';
import {useEffect, useState} from 'react';

type Point = {x: number; y: number};

type PendingHover = {enter: () => void; target: HTMLElement};

/**
 * How long the pointer can rest inside the triangle before the hovered item
 * takes over. A pointer that is still travelling to the submenu reports a move
 * every frame, so a few frames without one means it has reached its target.
 */
const REST_MS = 50;

export function useSafetyTriangle() {
  const [triangle] = useState(() => {
    let corridor: {edge: [Point, Point]; origin: Point; submenu: HTMLElement} | null =
      null;
    let pending: PendingHover | null = null;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let restTimeout: ReturnType<typeof setTimeout> | undefined;
    let abortController: AbortController | undefined;

    function cancel() {
      abortController?.abort();
      corridor = null;
      pending = null;
      clearTimeout(timeout);
      clearTimeout(restTimeout);
    }

    function restartRestTimer() {
      clearTimeout(restTimeout);
      restTimeout = setTimeout(release, REST_MS);
    }

    function release() {
      const hover = pending;
      cancel();
      if (hover?.target.isConnected) {
        hover.enter();
      }
    }

    function contains(point: Point) {
      if (!corridor) {
        return false;
      }
      const {origin, edge} = corridor;
      const cross = (a: Point, b: Point) =>
        (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x);
      const sides = [
        cross(origin, edge[0]),
        cross(edge[0], edge[1]),
        cross(edge[1], origin),
      ];
      return sides.every(side => side >= 0) || sides.every(side => side <= 0);
    }

    function move(event: PointerEvent) {
      if (corridor?.submenu.contains(event.target as Node)) {
        cancel();
      } else if (contains({x: event.clientX, y: event.clientY})) {
        restartRestTimer();
      } else {
        release();
      }
    }

    return {
      cancel,
      start(origin: Point, submenu: HTMLElement) {
        cancel();
        const rect = submenu.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return;
        }
        let edge: [Point, Point];
        if (origin.x < rect.left || origin.x > rect.right) {
          const x = origin.x < rect.left ? rect.left : rect.right;
          edge = [
            {x, y: rect.top},
            {x, y: rect.bottom},
          ];
        } else if (origin.y < rect.top || origin.y > rect.bottom) {
          const y = origin.y < rect.top ? rect.top : rect.bottom;
          edge = [
            {x: rect.left, y},
            {x: rect.right, y},
          ];
        } else {
          return;
        }
        corridor = {origin, edge, submenu};
        timeout = setTimeout(release, 300);
        restartRestTimer();
        abortController = new AbortController();
        const {signal} = abortController;
        document.addEventListener('pointermove', move, {signal});
        document.addEventListener('pointerdown', release, {capture: true, signal});
        document.addEventListener('keydown', cancel, {capture: true, signal});
      },
      defer(event: React.PointerEvent<HTMLElement>, enter: () => void) {
        if (event.pointerType !== 'mouse') {
          release();
          enter();
          return;
        }
        if (!contains({x: event.clientX, y: event.clientY})) {
          cancel();
          enter();
          return;
        }
        pending = {target: event.currentTarget, enter};
      },
      leave(target: HTMLElement) {
        if (pending?.target === target) {
          pending = null;
        }
      },
    };
  });

  useEffect(() => {
    return () => triangle.cancel();
  }, [triangle]);
  return triangle;
}
