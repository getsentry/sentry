import {useRef} from 'react';
import styled from '@emotion/styled';

import {SpanChart} from 'sentry/utils/profiling/spanChart';

interface FlamegraphSpansProps {
  spanChart: SpanChart;
}

export function FlamegraphSpans({spanChart: _spanChart}: FlamegraphSpansProps) {
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
