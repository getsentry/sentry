import {useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {SpanChartRenderer2D} from 'sentry/utils/profiling/renderers/spansRenderer';
import {SpanChart} from 'sentry/utils/profiling/spanChart';

interface FlamegraphSpansProps {
  canvasPoolManager: CanvasPoolManager;
  setSpansCanvasRef: React.Dispatch<React.SetStateAction<HTMLCanvasElement | null>>;
  spanChart: SpanChart;
  spansCanvas: FlamegraphCanvas | null;
  spansCanvasRef: HTMLCanvasElement | null;
  spansView: CanvasView<SpanChart> | null;
}

export function FlamegraphSpans({
  spanChart,
  canvasPoolManager,
  spansView,
  spansCanvas,
  spansCanvasRef,
  setSpansCanvasRef,
}: FlamegraphSpansProps) {
  const flamegraphTheme = useFlamegraphTheme();
  const scheduler = useMemo(() => new CanvasScheduler(), []);

  const spansRenderer = useMemo(() => {
    if (!spansCanvasRef) {
      return null;
    }

    return new SpanChartRenderer2D(spansCanvasRef, spanChart, flamegraphTheme);
  }, [spansCanvasRef, spanChart, flamegraphTheme]);

  useEffect(() => {
    canvasPoolManager.registerScheduler(scheduler);
    return () => canvasPoolManager.unregisterScheduler(scheduler);
  }, [canvasPoolManager, scheduler]);

  useEffect(() => {
    if (!spansCanvas || !spansView || !spansRenderer) {
      return undefined;
    }

    const drawSpans = () => {
      spansRenderer.draw(spansView.fromConfigView(spansCanvas.physicalSpace));
    };

    drawSpans();

    scheduler.registerBeforeFrameCallback(drawSpans);

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawSpans);
    };
  }, [spansCanvas, spansRenderer, scheduler, spansView]);

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
