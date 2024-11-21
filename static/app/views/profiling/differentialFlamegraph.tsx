import {useCallback, useLayoutEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {mat3} from 'gl-matrix';
import {vec2} from 'gl-matrix';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import Feature from 'sentry/components/acl/feature';
import {DifferentialFlamegraphLayout} from 'sentry/components/profiling/flamegraph/differentialFlamegraphLayout';
import {FlamegraphContextMenu} from 'sentry/components/profiling/flamegraph/flamegraphContextMenu';
import {DifferentialFlamegraphDrawer} from 'sentry/components/profiling/flamegraph/flamegraphDrawer/differentialFlamegraphDrawer';
import {DifferentialFlamegraphToolbar} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/differentialFlamegraphToolbar';
import {FlamegraphZoomView} from 'sentry/components/profiling/flamegraph/flamegraphZoomView';
import {FlamegraphZoomViewMinimap} from 'sentry/components/profiling/flamegraph/flamegraphZoomViewMinimap';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import type {DifferentialFlamegraph as DifferentialFlamegraphModel} from 'sentry/utils/profiling/differentialFlamegraph';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {FlamegraphThemeProvider} from 'sentry/utils/profiling/flamegraph/flamegraphThemeProvider';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useFlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphProfiles';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import type {Frame} from 'sentry/utils/profiling/frame';
import {
  computeConfigViewWithStrategy,
  formatColorForFrame,
  initializeFlamegraphRenderer,
  useResizeCanvasObserver,
} from 'sentry/utils/profiling/gl/utils';
import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useDifferentialFlamegraphModel} from 'sentry/utils/profiling/hooks/useDifferentialFlamegraphModel';
import {useDifferentialFlamegraphQuery} from 'sentry/utils/profiling/hooks/useDifferentialFlamegraphQuery';
import {FlamegraphRenderer2D} from 'sentry/utils/profiling/renderers/flamegraphRenderer2D';
import {FlamegraphRendererWebGL} from 'sentry/utils/profiling/renderers/flamegraphRendererWebGL';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {LOADING_PROFILE_GROUP} from 'sentry/views/profiling/profileGroupProvider';

const noopFormatDuration = () => '';

function applicationFrameOnly(frame: Frame): boolean {
  return frame.is_application;
}

function systemFrameOnly(frame: Frame): boolean {
  return !frame.is_application;
}

function DifferentialFlamegraphView() {
  const location = useLocation();
  const selection = usePageFilters();
  const flamegraphTheme = useFlamegraphTheme();
  const {colorCoding} = useFlamegraphPreferences();
  const {selectedRoot} = useFlamegraphProfiles();

  const [frameFilterSetting, setFrameFilterSetting] = useState<
    'application' | 'system' | 'all'
  >('all');

  const frameFilter =
    frameFilterSetting === 'application'
      ? applicationFrameOnly
      : frameFilterSetting === 'system'
        ? systemFrameOnly
        : undefined;

  const project = useCurrentProjectFromRouteParam();

  const [negated, setNegated] = useState<boolean>(false);
  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const {before, after} = useDifferentialFlamegraphQuery({
    projectID: parseInt((project?.id as string) ?? 0, 10),
    breakpoint: location.query.breakpoint as unknown as number,
    environments: selection.selection.environments,
    fingerprint: location.query.fingerprint as unknown as string,
  });

  const differentialFlamegraph = useDifferentialFlamegraphModel({
    before,
    after,
    frameFilter,
    negated,
  });

  const [flamegraphCanvasRef, setFlamegraphCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphOverlayCanvasRef, setFlamegraphOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const [flamegraphMiniMapCanvasRef, setFlamegraphMiniMapCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphMiniMapOverlayCanvasRef, setFlamegraphMiniMapOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const flamegraphCanvas = useMemo(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }
    return new FlamegraphCanvas(flamegraphCanvasRef, vec2.fromValues(0, 0));
  }, [flamegraphCanvasRef]);

  const flamegraphView = useMemo<CanvasView<DifferentialFlamegraphModel> | null>(
    () => {
      if (!flamegraphCanvas || !differentialFlamegraph.differentialFlamegraph) {
        return null;
      }

      const newView = new CanvasView({
        canvas: flamegraphCanvas,
        model: differentialFlamegraph.differentialFlamegraph,
        options: {
          inverted: differentialFlamegraph.differentialFlamegraph.inverted,
          minWidth:
            differentialFlamegraph.differentialFlamegraph.profile.minFrameDuration,
          barHeight: flamegraphTheme.SIZES.BAR_HEIGHT,
          depthOffset: flamegraphTheme.SIZES.AGGREGATE_FLAMEGRAPH_DEPTH_OFFSET,
          configSpaceTransform: undefined,
        },
      });

      return newView;
    },

    // We skip position.view dependency because it will go into an infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [differentialFlamegraph.differentialFlamegraph, flamegraphCanvas, flamegraphTheme]
  );

  // Uses a useLayoutEffect to ensure that these top level/global listeners are added before
  // any of the children components effects actually run. This way we do not lose events
  // when we register/unregister these top level listeners.
  useLayoutEffect(() => {
    if (!flamegraphCanvas || !flamegraphView) {
      return undefined;
    }

    // This code below manages the synchronization of the config views between spans and flamegraph
    // We do so by listening to the config view change event and then updating the other views accordingly which
    // allows us to keep the X axis in sync between the two views but keep the Y axis independent
    const onConfigViewChange = (rect: Rect, sourceConfigViewChange: CanvasView<any>) => {
      if (sourceConfigViewChange === flamegraphView) {
        flamegraphView.setConfigView(rect.withHeight(flamegraphView.configView.height));
      }

      canvasPoolManager.draw();
    };

    const onTransformConfigView = (
      mat: mat3,
      sourceTransformConfigView: CanvasView<any>
    ) => {
      if (sourceTransformConfigView === flamegraphView) {
        flamegraphView.transformConfigView(mat);
      }

      canvasPoolManager.draw();
    };

    const onResetZoom = () => {
      flamegraphView.resetConfigView(flamegraphCanvas);
      canvasPoolManager.draw();
    };

    const onZoomIntoFrame = (frame: FlamegraphFrame, strategy: 'min' | 'exact') => {
      const newConfigView = computeConfigViewWithStrategy(
        strategy,
        flamegraphView.configView,
        new Rect(frame.start, frame.depth, frame.end - frame.start, 1)
      ).transformRect(flamegraphView.configSpaceTransform);

      flamegraphView.setConfigView(newConfigView);

      canvasPoolManager.draw();
    };

    scheduler.on('set config view', onConfigViewChange);
    scheduler.on('transform config view', onTransformConfigView);
    scheduler.on('reset zoom', onResetZoom);
    scheduler.on('zoom at frame', onZoomIntoFrame);

    return () => {
      scheduler.off('set config view', onConfigViewChange);
      scheduler.off('transform config view', onTransformConfigView);
      scheduler.off('reset zoom', onResetZoom);
      scheduler.off('zoom at frame', onZoomIntoFrame);
    };
  }, [canvasPoolManager, flamegraphCanvas, flamegraphView, scheduler]);

  const flamegraphCanvases = useMemo(() => {
    return [flamegraphCanvasRef, flamegraphOverlayCanvasRef];
  }, [flamegraphCanvasRef, flamegraphOverlayCanvasRef]);

  const flamegraphCanvasBounds = useResizeCanvasObserver(
    flamegraphCanvases,
    canvasPoolManager,
    flamegraphCanvas,
    flamegraphView
  );

  const minimapCanvases = useMemo(() => {
    return [flamegraphMiniMapCanvasRef, flamegraphMiniMapOverlayCanvasRef];
  }, [flamegraphMiniMapCanvasRef, flamegraphMiniMapOverlayCanvasRef]);

  const flamegraphMiniMapCanvas = useMemo(() => {
    if (!flamegraphMiniMapCanvasRef) {
      return null;
    }
    return new FlamegraphCanvas(flamegraphMiniMapCanvasRef, vec2.fromValues(0, 0));
  }, [flamegraphMiniMapCanvasRef]);

  useResizeCanvasObserver(
    minimapCanvases,
    canvasPoolManager,
    flamegraphMiniMapCanvas,
    null
  );

  const flamegraphRenderer = useMemo(() => {
    if (!flamegraphCanvasRef || !differentialFlamegraph) {
      return null;
    }

    const renderer = initializeFlamegraphRenderer(
      [FlamegraphRendererWebGL, FlamegraphRenderer2D],
      [
        flamegraphCanvasRef,
        differentialFlamegraph.differentialFlamegraph,
        flamegraphTheme,
        {
          colorCoding,
          draw_border: true,
        },
      ]
    );

    if (renderer === null) {
      Sentry.captureException('Failed to initialize a flamegraph renderer');
      addErrorMessage('Failed to initialize renderer');
      return null;
    }

    return renderer;
  }, [colorCoding, differentialFlamegraph, flamegraphCanvasRef, flamegraphTheme]);

  const getFrameColor = useCallback(
    (frame: FlamegraphFrame) => {
      if (!flamegraphRenderer) {
        return '';
      }
      return formatColorForFrame(frame, flamegraphRenderer);
    },
    [flamegraphRenderer]
  );

  const rootNodes = useMemo(() => {
    return selectedRoot
      ? [selectedRoot]
      : differentialFlamegraph.differentialFlamegraph.root.children;
  }, [selectedRoot, differentialFlamegraph.differentialFlamegraph.root]);

  const referenceNode = useMemo(
    () =>
      selectedRoot ? selectedRoot : differentialFlamegraph.differentialFlamegraph.root,
    [selectedRoot, differentialFlamegraph.differentialFlamegraph.root]
  );

  return (
    <Feature features={['profiling-differential-flamegraph-page']}>
      <DifferentialFlamegraphContainer>
        <DifferentialFlamegraphToolbar
          frameFilter={frameFilterSetting}
          onFrameFilterChange={setFrameFilterSetting}
          negated={negated}
          onNegatedChange={setNegated}
          flamegraph={differentialFlamegraph.differentialFlamegraph}
          canvasPoolManager={canvasPoolManager}
        />
        <DifferentialFlamegraphLayout
          minimap={
            <FlamegraphZoomViewMinimap
              canvasPoolManager={canvasPoolManager}
              flamegraph={differentialFlamegraph.differentialFlamegraph}
              flamegraphMiniMapCanvas={flamegraphMiniMapCanvas}
              flamegraphMiniMapCanvasRef={flamegraphMiniMapCanvasRef}
              flamegraphMiniMapOverlayCanvasRef={flamegraphMiniMapOverlayCanvasRef}
              flamegraphMiniMapView={flamegraphView}
              setFlamegraphMiniMapCanvasRef={setFlamegraphMiniMapCanvasRef}
              setFlamegraphMiniMapOverlayCanvasRef={setFlamegraphMiniMapOverlayCanvasRef}
            />
          }
          flamegraph={
            <FlamegraphZoomView
              scheduler={scheduler}
              profileGroup={
                differentialFlamegraph.afterProfileGroup ?? LOADING_PROFILE_GROUP
              }
              disableGrid
              disableCallOrderSort
              disableColorCoding
              canvasBounds={flamegraphCanvasBounds}
              canvasPoolManager={canvasPoolManager}
              flamegraph={differentialFlamegraph.differentialFlamegraph}
              flamegraphRenderer={flamegraphRenderer}
              flamegraphCanvas={flamegraphCanvas}
              flamegraphCanvasRef={flamegraphCanvasRef}
              flamegraphOverlayCanvasRef={flamegraphOverlayCanvasRef}
              flamegraphView={flamegraphView}
              setFlamegraphCanvasRef={setFlamegraphCanvasRef}
              setFlamegraphOverlayCanvasRef={setFlamegraphOverlayCanvasRef}
              contextMenu={FlamegraphContextMenu}
            />
          }
          flamegraphDrawer={
            <DifferentialFlamegraphDrawer
              profileGroup={
                differentialFlamegraph.afterProfileGroup ?? LOADING_PROFILE_GROUP
              }
              getFrameColor={getFrameColor}
              referenceNode={referenceNode}
              rootNodes={rootNodes}
              flamegraph={differentialFlamegraph.differentialFlamegraph}
              formatDuration={
                differentialFlamegraph.differentialFlamegraph
                  ? differentialFlamegraph.differentialFlamegraph.formatter
                  : noopFormatDuration
              }
              canvasPoolManager={canvasPoolManager}
              canvasScheduler={scheduler}
            />
          }
        />
      </DifferentialFlamegraphContainer>
    </Feature>
  );
}

const DifferentialFlamegraphContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;

  ~ footer {
    display: none;
  }
`;

function DifferentialFlamegraphWithProviders() {
  return (
    <FlamegraphThemeProvider>
      <FlamegraphStateProvider
        initialState={{
          preferences: {
            sorting: 'alphabetical',
            view: 'top down',
          },
        }}
      >
        <DifferentialFlamegraphView />
      </FlamegraphStateProvider>
    </FlamegraphThemeProvider>
  );
}

export default DifferentialFlamegraphWithProviders;
