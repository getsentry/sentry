import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphView} from 'sentry/utils/profiling/flamegraphView';
import {SpanChartRenderer2D} from 'sentry/utils/profiling/renderers/spansRenderer';
import {SpanChart} from 'sentry/utils/profiling/spanChart';

interface FlamegraphSpansProps {
  canvasPoolManager: CanvasPoolManager;
  flamegraphView: FlamegraphView | null;
  setSpansCanvasRef: React.Dispatch<React.SetStateAction<HTMLCanvasElement | null>>;
  spanChart: SpanChart;
  spansCanvas: FlamegraphCanvas | null;
  spansCanvasRef: HTMLCanvasElement | null;
}

export function FlamegraphSpans({
  spanChart,
  canvasPoolManager,
  flamegraphView,
  spansCanvas,
  spansCanvasRef,
  setSpansCanvasRef,
}: FlamegraphSpansProps) {
  const scheduler = useMemo(() => new CanvasScheduler(), []);

  const spansRenderer = useMemo(() => {
    if (!spansCanvasRef) {
      return null;
    }

    return new SpanChartRenderer2D(spansCanvasRef, spanChart);
  }, [spansCanvasRef, spanChart]);

  useEffect(() => {
    canvasPoolManager.registerScheduler(scheduler);
    return () => canvasPoolManager.unregisterScheduler(scheduler);
  }, [canvasPoolManager, scheduler]);

  useEffect(() => {
    if (!spansCanvas || !flamegraphView || !spansRenderer) {
      return undefined;
    }

    const drawSpans = () => {
      spansRenderer.draw(flamegraphView.fromConfigSpace(spansCanvas.physicalSpace));
    };

    scheduler.registerBeforeFrameCallback(drawSpans);

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawSpans);
    };
  }, [spansCanvas, spansRenderer, scheduler, flamegraphView]);

  return <Canvas ref={ref => setSpansCanvasRef(ref)} />;
}

const Canvas = styled('canvas')`
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  user-select: none;
`;
