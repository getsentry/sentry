import {useCallback, useEffect, useLayoutEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {ViewHierarchyWindow} from 'sentry/components/events/viewHierarchy';
import {Project} from 'sentry/types';
import {defined} from 'sentry/utils';
import {Rect, watchForResize} from 'sentry/utils/profiling/gl/utils';

function useResizeCanvasObserver(canvases: (HTMLCanvasElement | null)[]): Rect {
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
        entries[0].contentRect ?? entries[0].target.getBoundingClientRect();

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

const MIN_BORDER_SIZE = 20;

interface ViewNode {
  node: ViewHierarchyWindow;
  rect: Rect;
}

export function getCoordinates(
  hierarchies: ViewHierarchyWindow[],
  shiftChildrenByParent: boolean = true
): {list: ViewNode[]; maxHeight: number; maxWidth: number} {
  const list: ViewNode[] = [];
  const queue: [Rect | null, ViewHierarchyWindow][] = [];
  hierarchies.forEach(root => queue.push([null, root]));

  let maxWidth = Number.MIN_SAFE_INTEGER;
  let maxHeight = Number.MIN_SAFE_INTEGER;

  while (queue.length) {
    const [parent, child] = queue.pop()!;

    const node = {
      node: child,
      rect:
        shiftChildrenByParent && parent
          ? new Rect(
              (parent.x ?? 0) + (child.x ?? 0),
              (parent.y ?? 0) + (child.y ?? 0),
              child.width ?? 0,
              child.height ?? 0
            )
          : new Rect(child.x ?? 0, child.y ?? 0, child.width ?? 0, child.height ?? 0),
    };
    list.push(node);

    maxWidth = Math.max(maxWidth, node.rect.x + (node.rect.width ?? 0));
    maxHeight = Math.max(maxHeight, node.rect.y + (node.rect.height ?? 0));

    if (defined(child.children) && child.children.length) {
      child.children.forEach(c => {
        queue.push([node.rect, c]);
      });
    }
  }

  return {list, maxWidth, maxHeight};
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

type WireframeProps = {
  hierarchy: ViewHierarchyWindow[];
  project: Project;
};

function Wireframe({hierarchy, project}: WireframeProps) {
  const [canvasRef, setCanvasRef] = useState<HTMLCanvasElement | null>(null);

  const canvases = useMemo(() => {
    return canvasRef ? [canvasRef] : [];
  }, [canvasRef]);

  const canvasSize = useResizeCanvasObserver(canvases);

  const coordinates = useMemo(
    () => getCoordinates(hierarchy, project.platform !== 'flutter'),
    [hierarchy, project]
  );

  const scale = useMemo(() => {
    return calculateScale(
      {width: canvasSize.width, height: canvasSize.height},
      {width: coordinates.maxWidth, height: coordinates.maxHeight},
      {
        x: MIN_BORDER_SIZE,
        y: MIN_BORDER_SIZE,
      }
    );
  }, [coordinates, canvasSize]);

  const transformationMatrix = useMemo(() => {
    const xCenter = Math.abs(canvasSize.width - coordinates.maxWidth * scale) / 2;
    const yCenter = Math.abs(canvasSize.height - coordinates.maxHeight * scale) / 2;

    // prettier-ignore
    return mat3.fromValues(
      scale, 0, 0,
      0, scale, 0,
      xCenter, yCenter, 1
    );
  }, [
    canvasSize.height,
    canvasSize.width,
    coordinates.maxHeight,
    coordinates.maxWidth,
    scale,
  ]);

  const draw = useCallback(
    (modelToView: mat3) => {
      const context = canvasRef?.getContext('2d');
      if (!context) {
        return;
      }

      // Context is stateful, so reset the transforms at the beginning of each
      // draw to properly clear the canvas from 0, 0
      context.resetTransform();
      context.clearRect(0, 0, canvasSize.width ?? 0, canvasSize.height ?? 0);

      context.setTransform(
        modelToView[0],
        modelToView[3],
        modelToView[1],
        modelToView[4],
        modelToView[6],
        modelToView[7]
      );

      context.fillStyle = 'rgb(88, 74, 192)';
      context.strokeStyle = 'black';
      context.lineWidth = 1;

      for (let i = 0; i < coordinates.list.length; i++) {
        context.strokeRect(
          coordinates.list[i].rect.x,
          coordinates.list[i].rect.y,
          coordinates.list[i].rect.width,
          coordinates.list[i].rect.height
        );
      }
    },
    [coordinates, canvasRef, canvasSize]
  );

  useEffect(() => {
    if (!canvasRef) {
      return undefined;
    }

    let start: vec2 | null;
    const currTransformationMatrix = mat3.create();

    const handleMouseDown = (e: MouseEvent) => {
      start = vec2.fromValues(e.offsetX, e.offsetY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (start) {
        const currPosition = vec2.fromValues(e.offsetX, e.offsetY);

        // Scale delta to account for device pixel density difference
        // between two points
        const delta = vec2.sub(vec2.create(), currPosition, start);
        vec2.scale(delta, delta, window.devicePixelRatio);

        // Transform from the original matrix as a starting point
        mat3.translate(currTransformationMatrix, transformationMatrix, delta);
        draw(currTransformationMatrix);
      }
    };

    const handleMouseUp = () => {
      // The panning has ended, store its transformations into the original matrix
      start = null;
      mat3.copy(transformationMatrix, currTransformationMatrix);
    };

    const options: AddEventListenerOptions & EventListenerOptions = {passive: true};

    canvasRef.addEventListener('mousedown', handleMouseDown, options);
    canvasRef.addEventListener('mousemove', handleMouseMove, options);
    canvasRef.addEventListener('mouseup', handleMouseUp, options);

    draw(transformationMatrix);

    return () => {
      canvasRef.removeEventListener('mousedown', handleMouseDown, options);
      canvasRef.removeEventListener('mousemove', handleMouseMove, options);
      canvasRef.removeEventListener('mouseup', handleMouseUp, options);
    };
  }, [transformationMatrix, canvasRef, draw, scale]);

  return <StyledCanvas ref={r => setCanvasRef(r)} />;
}

export {Wireframe};

const StyledCanvas = styled('canvas')`
  background-color: ${p => p.theme.surface100};
  width: 100%;
  height: 100%;
`;
