import {useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';

const COLORS = ['red', 'green', 'yellow'];

function getCoordinates(hierarchies) {
  return hierarchies.map((hierarchy, index) => {
    const results: any[] = [];
    let nodesToProcess = [hierarchy];
    while (nodesToProcess.length) {
      const node = nodesToProcess.pop();
      results.push({
        x: node.x ?? 0,
        y: node.y ?? 0,
        width: node.width ?? 0,
        height: node.height ?? 0,
        color: COLORS[index],
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

function Wireframe({hierarchy}) {
  const [xTranslation, setXTranslation] = useState(0);
  const [yTranslation, setYTranslation] = useState(0);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const mousedown = useRef([null, null]);
  const [dragging, setDragging] = useState(false);
  const [scaling, setScaling] = useState(1);
  const ctx = canvas.current?.getContext('2d');
  const coordinates = useMemo(() => {
    return getCoordinates(hierarchy);
  }, [hierarchy]);

  if (canvas.current) {
    canvas.current.height = 736;
    canvas.current.width = 1395;
  }

  if (ctx) {
    coordinates.forEach(hierarchy => {
      hierarchy.forEach(({x, y, width, height, color}) => {
        ctx.fillStyle = 'white';
        ctx.strokeStyle = 'black';
        ctx.rect(
          (x + xTranslation) * scaling,
          (y + yTranslation) * scaling,
          width * scaling,
          height * scaling
        );
        ctx.setLineDash([5, 2.5]);
        ctx.fill();
        ctx.stroke();
      });
    });
  }
  return (
    <React.Fragment>
      <button onClick={() => setScaling(scaling * 1.5)}>+</button>
      <button onClick={() => setScaling(scaling / 1.5)}>-</button>
      <StyledCanvas
        ref={canvas}
        onMouseDown={e => {
          console.log('x', e.clientX);
          console.log('y', e.clientY);
          mousedown.current = [e.clientX, e.clientY];
          setDragging(true);
        }}
        onMouseMove={e => {
          if (dragging) {
            console.log('x', e.clientX);
            console.log('y', e.clientY);
            const [prevX, prevY] = mousedown.current;
            setXTranslation(e.clientX - prevX);
            setYTranslation(e.clientY - prevY);
          }
        }}
        onMouseUp={e => {
          setDragging(false);
          mousedown.current = [e.clientX, e.clientY];
        }}
      />
    </React.Fragment>
  );
}

export {Wireframe};

const StyledCanvas = styled('canvas')`
  height: 736px;
  width: 1395px;
  background-color: ${p => p.theme.surface100};
`;
