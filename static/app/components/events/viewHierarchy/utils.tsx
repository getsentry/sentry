import {useLayoutEffect, useState} from 'react';
import {mat3, vec2} from 'gl-matrix';

import type {ViewHierarchyWindow} from 'sentry/components/events/viewHierarchy';
import type {ViewNode} from 'sentry/components/events/viewHierarchy/wireframe';
import {defined} from 'sentry/utils';
import {watchForResize} from 'sentry/utils/profiling/gl/utils';
import {Rect} from 'sentry/utils/profiling/speedscope';

export function useResizeCanvasObserver(canvases: (HTMLCanvasElement | null)[]): Rect {
  const [bounds, setCanvasBounds] = useState<Rect>(Rect.Empty());

  useLayoutEffect(() => {
    if (!canvases.length) {
      return undefined;
    }

    if (canvases.some(c => c === null)) {
      return undefined;
    }

    const observer = watchForResize(canvases as HTMLCanvasElement[], entries => {
      const contentRect =
        entries[0]!.contentRect ?? entries[0]!.target.getBoundingClientRect();

      setCanvasBounds(
        new Rect(
          contentRect.x,
          contentRect.y,
          contentRect.width * window.devicePixelRatio,
          contentRect.height * window.devicePixelRatio
        )
      );
    });

    return () => {
      observer.disconnect();
    };
  }, [canvases]);

  return bounds;
}

export function getHierarchyDimensions(
  hierarchies: ViewHierarchyWindow[],
  useAbsolutePosition: boolean = false
): {
  maxHeight: number;
  maxWidth: number;
  nodes: ViewNode[];
} {
  const nodes: ViewNode[] = [];
  const queue: [Rect | null, ViewHierarchyWindow][] = [];
  for (let i = hierarchies.length - 1; i >= 0; i--) {
    queue.push([null, hierarchies[i]!]);
  }

  let maxWidth = Number.MIN_SAFE_INTEGER;
  let maxHeight = Number.MIN_SAFE_INTEGER;

  while (queue.length) {
    const [parent, child] = queue.pop()!;

    const node = {
      node: child,
      rect: new Rect(
        useAbsolutePosition ? child.x ?? 0 : (parent?.x ?? 0) + (child.x ?? 0),
        useAbsolutePosition ? child.y ?? 0 : (parent?.y ?? 0) + (child.y ?? 0),
        child.width ?? 0,
        child.height ?? 0
      ),
    };
    nodes.push(node);

    if (defined(child.children) && child.children.length) {
      // Push the children into the queue in reverse order because the
      // output nodes should have early children before later children
      // i.e. we need to pop() off early children before ones that come after
      for (let i = child.children.length - 1; i >= 0; i--) {
        queue.push([node.rect, child.children[i]!]);
      }
    }

    maxWidth = Math.max(maxWidth, node.rect.x + (node.rect.width ?? 0));
    maxHeight = Math.max(maxHeight, node.rect.y + (node.rect.height ?? 0));
  }

  return {nodes, maxWidth, maxHeight};
}

export function calculateScale(
  bounds: {height: number; width: number},
  maxCoordinateDimensions: {height: number; width: number},
  border: {x: number; y: number}
) {
  return Math.min(
    (bounds.width - border.x) / maxCoordinateDimensions.width,
    (bounds.height - border.y) / maxCoordinateDimensions.height
  );
}

export function getDeepestNodeAtPoint(
  nodes: ViewNode[],
  point: vec2,
  transformationMatrix: mat3,
  scale: number
): ViewNode | null {
  let clickedNode: ViewNode | null = null;
  const inverseMatrix = mat3.invert(mat3.create(), transformationMatrix);
  if (!inverseMatrix) {
    return null;
  }

  vec2.scale(point, point, scale);
  const transformedPoint = vec2.transformMat3(vec2.create(), point, inverseMatrix);
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!;
    if (node!.rect.contains(transformedPoint)) {
      clickedNode = node;
    }
  }

  return clickedNode;
}
