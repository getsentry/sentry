import {useRef} from 'react';
import styled from '@emotion/styled';

import {SpanTree} from 'sentry/utils/profiling/spanTree';

interface FlamegraphSpansProps {
  spanTree: SpanTree;
}

export function FlamegraphSpans({spanTree: _spanTree}: FlamegraphSpansProps) {
  const spansCanvasRef = useRef<HTMLCanvasElement>(null);

  return <Canvas ref={spansCanvasRef} />;
}

const Canvas = styled('canvas')`
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  user-select: none;
`;
