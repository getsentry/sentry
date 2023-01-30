import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

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

function draw(context, coordinates) {
  coordinates.forEach(hierarchy => {
    hierarchy.forEach(({x, y, width, height}) => {
      context.fillStyle = 'white';
      context.strokeStyle = 'black';
      context.rect(x, y, width, height);
      context.setLineDash([5, 2.5]);
      context.fill();
      context.stroke();
    });
  });
}

function Wireframe({hierarchy}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const coordinates = useMemo(() => {
    return getCoordinates(hierarchy);
  }, [hierarchy]);
  const [dimensions, setDimensions] = useState({width: 0, height: 0});

  useEffect(() => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!canvas || !container) {
      return;
    }

    canvas.width = dimensions.width || container.clientWidth;
    canvas.height = dimensions.height || container.clientHeight;

    const context = canvas.getContext('2d');
    draw(context, coordinates);
  }, [coordinates, dimensions]);

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
      <StyledCanvas ref={canvasRef} />
    </Container>
  );
}

export {Wireframe};

const Container = styled('div')`
  height: 100%;
  width: 100%;
`;

const StyledCanvas = styled('canvas')`
  background-color: ${p => p.theme.surface100};
`;
