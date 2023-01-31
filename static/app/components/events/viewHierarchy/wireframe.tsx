import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import {ViewHierarchyWindow} from 'sentry/components/events/viewHierarchy';
import {useMousePan} from 'sentry/components/events/viewHierarchy/useMousePan';

const RECT_FILL_ALPHA = 0.005;
const RECT_OUTLINE_ALPHA = 1;

type Rect = Pick<ViewHierarchyWindow, 'x' | 'y' | 'width' | 'height'>;

export function getCoordinates(hierarchies: ViewHierarchyWindow[]) {
  return hierarchies.map(hierarchy => {
    const newHierarchy: Rect[] = [];

    const nodesToProcess = [hierarchy];
    while (nodesToProcess.length) {
      const node = nodesToProcess.pop()!;

      // Fetch coordinates off the current node
      newHierarchy.push({
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.width ?? 0,
        height: node.height ?? 0,
      });

      if ((node.children ?? []).length !== 0) {
        // Update the children's coords relative to the parent
        const newChildren =
          node.children?.map(child => ({
            ...child,
            x: (child.x ?? 0) + (node.x ?? 0),
            y: (child.y ?? 0) + (node.y ?? 0),
          })) ?? [];

        nodesToProcess.push(...newChildren);
      }
    }

    return newHierarchy;
  });
}

function getMaxDimensions(coordinates) {
  let maxWidth = 0;
  let maxHeight = 0;

  coordinates.forEach(hierarchy => {
    let currWidth = 0;
    let currHeight = 0;
    hierarchy.forEach(({x, y, width, height}) => {
      currWidth = Math.max(x + width, currWidth);
      currHeight = Math.max(y + height, currHeight);
    });
    maxWidth = Math.max(maxWidth, currWidth);
    maxHeight = Math.max(maxHeight, currHeight);
  });

  return {
    width: maxWidth,
    height: maxHeight,
  };
}

function calculateScale(
  bounds: {height: number; width: number},
  maxCoordinateDimensions: {height: number; width: number},
  offsets: {x: number; y: number}
) {
  return Math.min(
    (bounds.width - offsets.x) / maxCoordinateDimensions.width,
    (bounds.height - offsets.y) / maxCoordinateDimensions.height
  );
}

function Wireframe({hierarchy}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coordinates = useMemo(() => getCoordinates(hierarchy), [hierarchy]);

  const [dimensions, setDimensions] = useState({width: 0, height: 0});

  const {handlePanMove, handlePanStart, handlePanStop, isDragging, xOffset, yOffset} =
    useMousePan({initialXOffset: 0, initialYOffset: 0});

  const draw = useCallback(
    (context: CanvasRenderingContext2D) => {
      // Make areas with more overlayed elements darker
      context.globalCompositeOperation = 'overlay';

      // TODO(nar): calculate proper center offsets
      const maxDimensions = getMaxDimensions(coordinates);
      const xCenter = 20;
      const yCenter = 20;

      // Set the scaling
      const scalingFactor = calculateScale(dimensions, maxDimensions, {
        x: xCenter,
        y: yCenter,
      });
      context.scale(scalingFactor, scalingFactor);

      // Translate the canvas to account for mouse panning
      // and centering
      context.translate(
        (xOffset + xCenter) / scalingFactor,
        (yOffset + yCenter / 2) / scalingFactor
      );

      coordinates.forEach(hierarchyCoords => {
        hierarchyCoords.forEach(({x, y, width, height}) => {
          // Prepare rectangles for drawing
          context.fillStyle = 'rgb(88, 74, 192)';
          context.strokeStyle = 'black';
          context.lineWidth = 1;
          context.rect(x, y, width, height);

          // Draw the rectangles
          context.globalAlpha = RECT_FILL_ALPHA;
          context.fill();

          // Draw the outlines
          context.globalAlpha = RECT_OUTLINE_ALPHA;
          context.stroke();
        });
      });
    },
    [coordinates, dimensions, xOffset, yOffset]
  );

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container) {
      return;
    }

    canvas.width = dimensions.width || container.clientWidth;
    canvas.height = dimensions.height || container.clientHeight;

    const context = canvas.getContext('2d');
    if (context) {
      draw(context);
    }
  }, [dimensions.height, dimensions.width, draw]);

  useResizeObserver({
    ref: containerRef,
    onResize: () => {
      if (!containerRef.current) {
        return;
      }

      const {clientWidth, clientHeight} = containerRef.current;
      const needsResize =
        dimensions.width !== clientWidth || dimensions.height !== clientHeight;

      if (needsResize) {
        setDimensions({
          width: clientWidth ?? 0,
          height: clientHeight ?? 0,
        });
      }
    },
  });

  return (
    <Container ref={containerRef}>
      <StyledCanvas
        ref={canvasRef}
        onMouseDown={handlePanStart}
        onMouseUp={handlePanStop}
        onMouseLeave={handlePanStop}
        onMouseMove={handlePanMove}
        isDragging={isDragging}
      />
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
`;
