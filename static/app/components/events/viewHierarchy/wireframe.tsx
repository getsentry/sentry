import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import {useMousePan} from 'sentry/components/events/viewHierarchy/useMousePan';

function getCoordinates(hierarchies) {
  return hierarchies.map(hierarchy => {
    const results: any[] = [];
    let nodesToProcess = [hierarchy];
    while (nodesToProcess.length) {
      const node = nodesToProcess.pop();
      results.push({
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.width ?? 0,
        height: node.height ?? 0,
      });
      if ((node.children ?? []).length !== 0) {
        node.children.forEach(child => {
          child.x = child.x + (node.x ?? 0);
          child.y = child.y + (node.y ?? 0);
        });
        nodesToProcess = [...nodesToProcess, ...node.children];
      }
    }
    return results;
  });
}

function draw(context, coordinates, xOffset, yOffset) {
  // Make areas with more overlayed elements darker
  context.globalCompositeOperation = 'overlay';

  coordinates.forEach(hierarchy => {
    hierarchy.forEach(({x, y, width, height}) => {
      // Prepare rectangles for drawing
      context.fillStyle = 'rgb(88, 74, 192)';
      context.strokeStyle = 'black';
      context.lineWidth = 1;
      context.rect(x + xOffset, y + yOffset, width, height);

      // Draw the rectangles
      context.globalAlpha = '0.005';
      context.fill();

      context.globalAlpha = '1';
      context.stroke();
    });
  });
}

function Wireframe({hierarchy}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coordinates = useMemo(() => getCoordinates(hierarchy), [hierarchy]);

  const [dimensions, setDimensions] = useState({width: 0, height: 0});

  const {handlePanMove, handlePanStart, handlePanStop, isDragging, xOffset, yOffset} =
    useMousePan();

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container) {
      return;
    }

    canvas.width = dimensions.width || container.clientWidth;
    canvas.height = dimensions.height || container.clientHeight;

    const context = canvas.getContext('2d');
    draw(context, coordinates, xOffset, yOffset);
  }, [coordinates, dimensions, xOffset, yOffset]);

  useResizeObserver({
    ref: containerRef,
    onResize: () => {
      if (!containerRef.current) {
        return;
      }

      const {clientWidth = 0, clientHeight = 0} = containerRef.current;
      const needsResize =
        dimensions.width !== clientWidth || dimensions.height !== clientHeight;

      if (needsResize) {
        setDimensions({
          width: containerRef.current?.clientWidth ?? 0,
          height: containerRef.current?.clientHeight ?? 0,
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

const Container = styled('div')`
  height: 100%;
  width: 100%;
`;

const StyledCanvas = styled('canvas')<{isDragging: boolean}>`
  background-color: ${p => p.theme.surface100};
  cursor: ${p => (p.isDragging ? 'grabbing' : 'grab')};
`;
