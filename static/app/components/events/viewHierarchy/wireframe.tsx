import {useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState} from 'react';
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
        new Rect(contentRect.x, contentRect.y, contentRect.width, contentRect.height)
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
  const list: any[] = [];
  const queue: any[] = [...hierarchies.map(h => [null, h])];

  let maxWidth = Number.MIN_SAFE_INTEGER;
  let maxHeight = Number.MIN_SAFE_INTEGER;

  while (queue.length) {
    const [parent, child] = queue.pop();

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
        queue.push([child, c]);
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
  const containerRef = useRef<HTMLDivElement | null>(null);
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
    return (
      calculateScale(
        {width: canvasSize.width ?? 0, height: canvasSize.height ?? 0},
        {width: coordinates.maxWidth, height: coordinates.maxHeight},
        {
          x: MIN_BORDER_SIZE,
          y: MIN_BORDER_SIZE,
        }
      ) * window.devicePixelRatio
    );
  }, [coordinates, canvasSize]);

  const transformationMatrix = useMemo(() => {
    // prettier-ignore
    return mat3.fromValues(
      scale,0,0,
      0,scale,0,
      0,0,1
    );
  }, [scale]);

  const draw = useCallback(
    (modelToView: mat3) => {
      const context = canvasRef?.getContext('2d');
      if (!context) {
        return;
      }

      context.resetTransform();
      context.clearRect(
        0,
        0,
        (canvasSize.width ?? 0) * window.devicePixelRatio,
        (canvasSize.height ?? 0) * window.devicePixelRatio
      );

      // Set the scaling
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
    const handleMouseDown = (e: MouseEvent) => {
      start = vec2.fromValues(e.offsetX, e.offsetY);
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (start) {
        const end = vec2.fromValues(e.offsetX, e.offsetY);
        const delta = vec2.sub(vec2.create(), start, end);
        const inverse = mat3.invert(mat3.create(), transformationMatrix);

        vec2.transformMat3(delta, delta, inverse);
        mat3.add(
          transformationMatrix,
          transformationMatrix,
          mat3.fromValues(0, 0, 0, 0, 0, 0, delta[0], delta[1], 0)
        );
        draw(transformationMatrix);
      }
    };

    const handleMouseUp = () => {
      start = null;
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
  }, [transformationMatrix, canvasRef, draw]);

  return (
    <Container ref={containerRef}>
      <StyledCanvas ref={r => setCanvasRef(r)} isDragging={false} />
    </Container>
  );
}

export {Wireframe};

// This container wraps the canvas so we can stretch it to fit
// the space we want and then read the width and height
// to resize the canvas
const Container = styled('div')`
  height: 100%;
  width: 100%;
`;

const StyledCanvas = styled('canvas')<{isDragging: boolean}>`
  background-color: ${p => p.theme.surface100};
  cursor: ${p => (p.isDragging ? 'grabbing' : 'grab')};
  width: 100%;
  height: 100%;
`;
