import {CSSProperties, Fragment, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';
import {mat3} from 'gl-matrix';

import {t} from 'sentry/locale';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import type {FlamegraphChart} from 'sentry/utils/profiling/flamegraphChart';
import {transformMatrixBetweenRect} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphChartRenderer} from 'sentry/utils/profiling/renderers/chartRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {useProfiles} from 'sentry/views/profiling/profilesProvider';

import {
  CollapsibleTimelineLoadingIndicator,
  CollapsibleTimelineMessage,
} from './collapsibleTimeline';

interface FlamegraphChartProps {
  canvasBounds: Rect;
  canvasPoolManager: CanvasPoolManager;
  chart: FlamegraphChart | null;
  cpuChartCanvas: FlamegraphCanvas | null;
  cpuChartCanvasRef: HTMLCanvasElement | null;
  cpuChartView: CanvasView<FlamegraphChart> | null;
  setCpuChartCanvasRef: (ref: HTMLCanvasElement | null) => void;
}

export function FlamegraphCpuChart({
  chart,
  canvasPoolManager,
  cpuChartView,
  cpuChartCanvas,
  cpuChartCanvasRef,
  setCpuChartCanvasRef,
}: FlamegraphChartProps) {
  const profiles = useProfiles();
  const scheduler = useCanvasScheduler(canvasPoolManager);
  const theme = useFlamegraphTheme();

  const cpuChartRenderer = useMemo(() => {
    if (!cpuChartCanvasRef || !chart) {
      return null;
    }

    return new FlamegraphChartRenderer(cpuChartCanvasRef, chart, theme);
  }, [cpuChartCanvasRef, chart, theme]);

  useEffect(() => {
    if (!cpuChartCanvas || !chart || !cpuChartView || !cpuChartRenderer) {
      return undefined;
    }

    const drawCpuChart = () => {
      const configViewToPhysicalSpaceTransform = transformMatrixBetweenRect(
        cpuChartView.configView,
        cpuChartCanvas.physicalSpace
      );

      const offsetPhysicalSpace = cpuChartCanvas.physicalSpace
        // move the chart down by the padding
        .withY(theme.SIZES.CHART_PX_PADDING)
        // shrink the chart height by 2X the padding
        .withHeight(
          cpuChartCanvas.physicalSpace.height - theme.SIZES.CHART_PX_PADDING * 2
        );

      const physicalSpaceToOffsetPhysicalSpaceTransform = transformMatrixBetweenRect(
        cpuChartCanvas.physicalSpace,
        offsetPhysicalSpace
      );

      const fromConfigView = mat3.create();
      mat3.multiply(
        fromConfigView,
        configViewToPhysicalSpaceTransform,
        physicalSpaceToOffsetPhysicalSpaceTransform
      );
      mat3.multiply(
        fromConfigView,
        fromConfigView,
        offsetPhysicalSpace.invertYTransform()
      );

      cpuChartRenderer.draw(
        cpuChartView.configView,
        cpuChartView.configSpace,
        cpuChartCanvas.physicalSpace,
        fromConfigView
      );
    };

    scheduler.registerBeforeFrameCallback(drawCpuChart);
    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawCpuChart);
    };
  }, [scheduler, chart, cpuChartCanvas, cpuChartRenderer, cpuChartView, theme]);

  return (
    <Fragment>
      <Canvas ref={setCpuChartCanvasRef} />
      {/* transaction loads after profile, so we want to show loading even if it's in initial state */}
      {profiles.type === 'loading' || profiles.type === 'initial' ? (
        <CollapsibleTimelineLoadingIndicator />
      ) : profiles.type === 'resolved' && !chart?.series.length ? (
        <CollapsibleTimelineMessage>
          {t('Profile has no CPU measurements')}
        </CollapsibleTimelineMessage>
      ) : null}
    </Fragment>
  );
}

const Canvas = styled('canvas')<{cursor?: CSSProperties['cursor']}>`
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  user-select: none;
  cursor: ${p => p.cursor};
`;
