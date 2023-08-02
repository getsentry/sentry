import {CSSProperties, Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import {mat3, vec2} from 'gl-matrix';

import {t} from 'sentry/locale';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import type {FlamegraphChart} from 'sentry/utils/profiling/flamegraphChart';
import {
  getConfigViewTranslationBetweenVectors,
  getPhysicalSpacePositionFromOffset,
  transformMatrixBetweenRect,
} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphChartRenderer} from 'sentry/utils/profiling/renderers/chartRenderer';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {useProfiles} from 'sentry/views/profiling/profilesProvider';

import {useCanvasScroll} from './interactions/useCanvasScroll';
import {useCanvasZoomOrScroll} from './interactions/useCanvasZoomOrScroll';
import {useInteractionViewCheckPoint} from './interactions/useInteractionViewCheckPoint';
import {useWheelCenterZoom} from './interactions/useWheelCenterZoom';
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

  const [configSpaceCursor, setConfigSpaceCursor] = useState<vec2 | null>(null);
  const [startInteractionVector, setStartInteractionVector] = useState<vec2 | null>(null);
  const [lastInteraction, setLastInteraction] = useState<
    'pan' | 'click' | 'zoom' | 'scroll' | 'select' | 'resize' | null
  >(null);

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
        // shrink the chart height by the padding to pad the top of chart
        .withHeight(cpuChartCanvas.physicalSpace.height - theme.SIZES.CHART_PX_PADDING);

      const physicalSpaceToOffsetPhysicalSpaceTransform = transformMatrixBetweenRect(
        cpuChartCanvas.physicalSpace,
        offsetPhysicalSpace
      );

      const fromConfigView = mat3.create();
      mat3.multiply(
        fromConfigView,
        physicalSpaceToOffsetPhysicalSpaceTransform,
        configViewToPhysicalSpaceTransform
      );
      mat3.multiply(
        fromConfigView,
        cpuChartCanvas.physicalSpace.invertYTransform(),
        fromConfigView
      );

      cpuChartRenderer.draw(
        cpuChartView.configView,
        cpuChartView.configSpace,
        cpuChartCanvas.physicalSpace,
        fromConfigView,
        cpuChartView.toConfigView(cpuChartCanvas.logicalSpace)
      );
    };

    scheduler.registerBeforeFrameCallback(drawCpuChart);
    scheduler.draw();

    return () => {
      scheduler.unregisterBeforeFrameCallback(drawCpuChart);
    };
  }, [scheduler, chart, cpuChartCanvas, cpuChartRenderer, cpuChartView, theme]);

  const onMouseDrag = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!cpuChartCanvas || !cpuChartView || !startInteractionVector) {
        return;
      }

      const configDelta = getConfigViewTranslationBetweenVectors(
        evt.nativeEvent.offsetX,
        evt.nativeEvent.offsetY,
        startInteractionVector,
        cpuChartView,
        cpuChartCanvas
      );

      if (!configDelta) {
        return;
      }

      canvasPoolManager.dispatch('transform config view', [configDelta, cpuChartView]);
      setStartInteractionVector(
        getPhysicalSpacePositionFromOffset(
          evt.nativeEvent.offsetX,
          evt.nativeEvent.offsetY
        )
      );
    },
    [cpuChartCanvas, cpuChartView, startInteractionVector, canvasPoolManager]
  );

  const onCanvasMouseMove = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      if (!cpuChartCanvas || !cpuChartView) {
        return;
      }

      const configSpaceMouse = cpuChartView.getConfigViewCursor(
        vec2.fromValues(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY),
        cpuChartCanvas
      );

      setConfigSpaceCursor(configSpaceMouse);

      if (startInteractionVector) {
        onMouseDrag(evt);
        setLastInteraction('pan');
      } else {
        setLastInteraction(null);
      }
    },
    [cpuChartCanvas, cpuChartView, onMouseDrag, startInteractionVector]
  );

  const onMapCanvasMouseUp = useCallback(() => {
    setConfigSpaceCursor(null);
    setLastInteraction(null);
  }, []);

  useEffect(() => {
    window.addEventListener('mouseup', onMapCanvasMouseUp);

    return () => {
      window.removeEventListener('mouseup', onMapCanvasMouseUp);
    };
  }, [onMapCanvasMouseUp]);

  const onWheelCenterZoom = useWheelCenterZoom(
    cpuChartCanvas,
    cpuChartView,
    canvasPoolManager
  );
  const onCanvasScroll = useCanvasScroll(cpuChartCanvas, cpuChartView, canvasPoolManager);

  useCanvasZoomOrScroll({
    setConfigSpaceCursor,
    setLastInteraction,
    handleWheel: onWheelCenterZoom,
    handleScroll: onCanvasScroll,
    canvas: cpuChartCanvasRef,
  });

  useInteractionViewCheckPoint({
    view: cpuChartView,
    lastInteraction,
  });

  // When a user click anywhere outside the spans, clear cursor and selected node
  useEffect(() => {
    const onClickOutside = (evt: MouseEvent) => {
      if (!cpuChartCanvasRef || cpuChartCanvasRef.contains(evt.target as Node)) {
        return;
      }
      setConfigSpaceCursor(null);
    };

    document.addEventListener('click', onClickOutside);

    return () => {
      document.removeEventListener('click', onClickOutside);
    };
  });

  const onCanvasMouseLeave = useCallback(() => {
    setConfigSpaceCursor(null);
    setStartInteractionVector(null);
    setLastInteraction(null);
  }, []);

  const onCanvasMouseDown = useCallback((evt: React.MouseEvent<HTMLCanvasElement>) => {
    setLastInteraction('click');
    setStartInteractionVector(
      getPhysicalSpacePositionFromOffset(evt.nativeEvent.offsetX, evt.nativeEvent.offsetY)
    );
  }, []);

  const onCanvasMouseUp = useCallback(
    (evt: React.MouseEvent<HTMLCanvasElement>) => {
      evt.preventDefault();
      evt.stopPropagation();

      if (!cpuChartView) {
        return;
      }

      if (!configSpaceCursor) {
        setLastInteraction(null);
        setStartInteractionVector(null);
        return;
      }

      setLastInteraction(null);
      setStartInteractionVector(null);
    },
    [configSpaceCursor, cpuChartView]
  );

  return (
    <Fragment>
      <Canvas
        ref={setCpuChartCanvasRef}
        onMouseMove={onCanvasMouseMove}
        onMouseLeave={onCanvasMouseLeave}
        onMouseUp={onCanvasMouseUp}
        onMouseDown={onCanvasMouseDown}
        cursor={lastInteraction === 'pan' ? 'grabbing' : 'default'}
      />
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
