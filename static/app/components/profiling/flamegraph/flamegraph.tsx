import {
  Fragment,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {mat3, vec2} from 'gl-matrix';

import {
  ProfileDragDropImport,
  ProfileDragDropImportProps,
} from 'sentry/components/profiling/flamegraph/flamegraphOverlays/profileDragDropImport';
import {FlamegraphOptionsMenu} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphOptionsMenu';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphSearch';
import {
  FlamegraphThreadSelector,
  FlamegraphThreadSelectorProps,
} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphThreadSelector';
import {FlamegraphToolbar} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphToolbar';
import {
  FlamegraphViewSelectMenu,
  FlamegraphViewSelectMenuProps,
} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphViewSelectMenu';
import {FlamegraphZoomView} from 'sentry/components/profiling/flamegraph/flamegraphZoomView';
import {FlamegraphZoomViewMinimap} from 'sentry/components/profiling/flamegraph/flamegraphZoomViewMinimap';
import {defined} from 'sentry/utils';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useFlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphProfiles';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphZoomPosition} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphZoomPosition';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {
  computeConfigViewWithStrategy,
  formatColorForFrame,
  Rect,
  useResizeCanvasObserver,
} from 'sentry/utils/profiling/gl/utils';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {SpanChart} from 'sentry/utils/profiling/spanChart';
import {SpanTree} from 'sentry/utils/profiling/spanTree';
import {formatTo, ProfilingFormatterUnit} from 'sentry/utils/profiling/units/units';
import {useDevicePixelRatio} from 'sentry/utils/useDevicePixelRatio';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';

import {FlamegraphDrawer} from './flamegraphDrawer/flamegraphDrawer';
import {FlamegraphWarnings} from './flamegraphOverlays/FlamegraphWarnings';
import {FlamegraphLayout} from './flamegraphLayout';
import {FlamegraphSpans} from './flamegraphSpans';

function getTransactionConfigSpace(
  profileGroup: ProfileGroup,
  startedAt: number,
  unit: ProfilingFormatterUnit | string
): Rect {
  const duration = profileGroup.metadata.durationNS;

  // If durationNs is present, use it
  if (typeof duration === 'number') {
    return new Rect(startedAt, 0, formatTo(duration, 'nanoseconds', unit), 0);
  }

  // else fallback to Math.max of profile durations
  const maxProfileDuration = Math.max(...profileGroup.profiles.map(p => p.duration));
  return new Rect(startedAt, 0, maxProfileDuration, 0);
}

const FALLBACK_FLAMEGRAPH = FlamegraphModel.Empty();

const noopFormatDuration = () => '';
interface FlamegraphProps {
  onImport: ProfileDragDropImportProps['onImport'];
  profiles: ProfileGroup;
  spanTree: SpanTree | null;
}

function Flamegraph(props: FlamegraphProps): ReactElement {
  const devicePixelRatio = useDevicePixelRatio();
  const dispatch = useDispatchFlamegraphState();

  const flamegraphTheme = useFlamegraphTheme();
  const position = useFlamegraphZoomPosition();
  const {sorting, view, xAxis} = useFlamegraphPreferences();
  const {threadId, selectedRoot, zoomIntoFrame, highlightFrames} =
    useFlamegraphProfiles();

  const [flamegraphCanvasRef, setFlamegraphCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphOverlayCanvasRef, setFlamegraphOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const [flamegraphMiniMapCanvasRef, setFlamegraphMiniMapCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphMiniMapOverlayCanvasRef, setFlamegraphMiniMapOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const [spansCanvasRef, setSpansCanvasRef] = useState<HTMLCanvasElement | null>(null);

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const profile = useMemo(() => {
    return props.profiles.profiles.find(p => p.threadId === threadId);
  }, [props.profiles, threadId]);

  const spanChart = useMemo(() => {
    if (!props.spanTree || !profile) {
      return null;
    }

    return new SpanChart(props.spanTree, {unit: profile.unit});
  }, [props.spanTree, profile]);

  const flamegraph = useMemo(() => {
    if (typeof threadId !== 'number') {
      return FALLBACK_FLAMEGRAPH;
    }

    // This could happen if threadId was initialized from query string, but for some
    // reason the profile was removed from the list of profiles.
    if (!profile) {
      return FALLBACK_FLAMEGRAPH;
    }

    return new FlamegraphModel(profile, threadId, {
      inverted: view === 'bottom up',
      leftHeavy: sorting === 'left heavy',
      configSpace:
        xAxis === 'transaction'
          ? getTransactionConfigSpace(props.profiles, profile.startedAt, profile.unit)
          : undefined,
    });
  }, [profile, props.profiles, sorting, threadId, view, xAxis]);

  const flamegraphCanvas = useMemo(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }
    return new FlamegraphCanvas(
      flamegraphCanvasRef,
      vec2.fromValues(0, flamegraphTheme.SIZES.TIMELINE_HEIGHT * devicePixelRatio)
    );
  }, [devicePixelRatio, flamegraphCanvasRef, flamegraphTheme]);

  const flamegraphMiniMapCanvas = useMemo(() => {
    if (!flamegraphMiniMapCanvasRef) {
      return null;
    }
    return new FlamegraphCanvas(flamegraphMiniMapCanvasRef, vec2.fromValues(0, 0));
  }, [flamegraphMiniMapCanvasRef]);

  const spansCanvas = useMemo(() => {
    if (!spansCanvasRef) {
      return null;
    }
    return new FlamegraphCanvas(spansCanvasRef, vec2.fromValues(0, 0));
  }, [spansCanvasRef]);

  const flamegraphView = useMemoWithPrevious<CanvasView<FlamegraphModel> | null>(
    previousView => {
      if (!flamegraphCanvas) {
        return null;
      }

      const newView = new CanvasView({
        canvas: flamegraphCanvas,
        model: flamegraph,
        options: {
          inverted: flamegraph.inverted,
          minWidth: flamegraph.profile.minFrameDuration,
          barHeight: flamegraphTheme.SIZES.BAR_HEIGHT,
          depthOffset: flamegraphTheme.SIZES.FLAMEGRAPH_DEPTH_OFFSET,
          configSpaceTransform:
            xAxis === 'transaction'
              ? new Rect(flamegraph.profile.startedAt, 0, 0, 0)
              : Rect.Empty(),
        },
      });

      if (
        // if the profile or the config space of the flamegraph has changed, we do not
        // want to persist the config view. This is to avoid a case where the new config space
        // is larger than the previous one, meaning the new view could now be zoomed in even
        // though the user did not fire any zoom events.
        previousView?.model.profile === newView.model.profile &&
        previousView.configSpace.equals(newView.configSpace)
      ) {
        if (
          // if we're still looking at the same profile but only a preference other than
          // left heavy has changed, we do want to persist the config view
          previousView.model.leftHeavy === newView.model.leftHeavy
        ) {
          newView.setConfigView(
            previousView.configView.withHeight(newView.configView.height)
          );
        }
      } else if (
        // When the profile changes, it may be because it finally loaded and if a zoom
        // was specified, this should be used as the initial view.
        defined(zoomIntoFrame)
      ) {
        const newConfigView = computeConfigViewWithStrategy(
          'min',
          newView.configView,
          new Rect(
            zoomIntoFrame.start,
            zoomIntoFrame.depth,
            zoomIntoFrame.end - zoomIntoFrame.start,
            1
          )
        );
        newView.setConfigView(newConfigView);
        return newView;
      }

      if (defined(highlightFrames)) {
        const [firstFrame, ...frames] = flamegraph.findAllMatchingFrames(
          highlightFrames.name,
          highlightFrames.package
        );

        if (firstFrame) {
          const rectParams = frames.reduce(
            (acc, frame) => {
              acc.x = Math.min(acc.x, frame.start);
              acc.y = Math.min(acc.y, frame.depth);
              acc.width = Math.max(acc.width, frame.end);
              return acc;
            },
            {
              x: firstFrame.start,
              y: firstFrame.depth,
              width: firstFrame.end,
            }
          );

          const newConfigView = computeConfigViewWithStrategy(
            'min',
            newView.configView,
            new Rect(rectParams.x, rectParams.y, rectParams.width, 1)
          );
          newView.setConfigView(newConfigView);
          return newView;
        }
      }

      // Because we render empty flamechart while we fetch the data, we need to make sure
      // to have some heuristic when the data is fetched to determine if we should
      // initialize the config view to the full view or a predefined value
      if (
        position.view &&
        !position.view.isEmpty() &&
        previousView?.model === FALLBACK_FLAMEGRAPH
      ) {
        newView.setConfigView(position.view);
      }

      return newView;
    },

    // We skip position.view dependency because it will go into an infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flamegraph, flamegraphCanvas, flamegraphTheme, zoomIntoFrame, xAxis]
  );

  const spansView = useMemoWithPrevious<CanvasView<SpanChart> | null>(
    _previousView => {
      if (!spansCanvas || !spanChart || !flamegraphView) {
        return null;
      }

      const newView = new CanvasView({
        canvas: spansCanvas,
        model: spanChart,
        options: {
          inverted: false,
          minWidth: spanChart.minSpanDuration,
          barHeight: flamegraphTheme.SIZES.SPANS_BAR_HEIGHT,
          depthOffset: flamegraphTheme.SIZES.SPANS_DEPTH_OFFSET,
          configSpaceTransform:
            // When a standalone axis is selected, the spans need to be relative to profile start time
            xAxis === 'standalone'
              ? new Rect(-flamegraph.profile.startedAt, 0, 0, 0)
              : Rect.Empty(),
        },
      });

      // Initialize configView to whatever the flamegraph configView is
      newView.setConfigView(flamegraphView?.configView);

      return newView;
    },
    [spanChart, spansCanvas, xAxis, flamegraph.profile.startedAt, flamegraphTheme.SIZES]
  );

  // We want to make sure that the views have the same min zoom levels so that
  // if you wheel zoom on one, the other one will also zoom to the same level of detail.
  // If we dont do this, then at some point during the zoom action the views will
  // detach and only one will zoom while the other one will stay at the same zoom level.
  useEffect(() => {
    if (flamegraphView && spansView) {
      const minWidthBetweenViews = Math.min(flamegraphView.minWidth, spansView.minWidth);
      flamegraphView.setMinWidth(minWidthBetweenViews);
      spansView.setMinWidth(minWidthBetweenViews);
    }
  });

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

        if (spansView) {
          const beforeY = spansView.configView.y;
          spansView.setConfigView(
            rect.withHeight(spansView.configView.height).withY(beforeY)
          );
        }
      }

      if (sourceConfigViewChange === spansView) {
        spansView.setConfigView(rect.withHeight(spansView.configView.height));
        const beforeY = flamegraphView.configView.y;
        flamegraphView.setConfigView(
          rect.withHeight(flamegraphView.configView.height).withY(beforeY)
        );
      }
      canvasPoolManager.draw();
    };

    const onTransformConfigView = (
      mat: mat3,
      sourceTransformConfigView: CanvasView<any>
    ) => {
      if (sourceTransformConfigView === flamegraphView) {
        flamegraphView.transformConfigView(mat);
        if (spansView) {
          const beforeY = spansView.configView.y;
          spansView.transformConfigView(mat);
          spansView.setConfigView(spansView.configView.withY(beforeY));
        }
      }

      if (sourceTransformConfigView === spansView) {
        spansView.transformConfigView(mat);
        const beforeY = flamegraphView.configView.y;
        flamegraphView.transformConfigView(mat);
        flamegraphView.setConfigView(flamegraphView.configView.withY(beforeY));
      }

      canvasPoolManager.draw();
    };

    const onResetZoom = () => {
      flamegraphView.resetConfigView(flamegraphCanvas);
      if (spansView && spansCanvas) {
        spansView.resetConfigView(spansCanvas);
      }
      canvasPoolManager.draw();
    };

    const onZoomIntoFrame = (frame: FlamegraphFrame, strategy: 'min' | 'exact') => {
      const newConfigView = computeConfigViewWithStrategy(
        strategy,
        flamegraphView.configView,
        new Rect(frame.start, frame.depth, frame.end - frame.start, 1)
      );

      flamegraphView.setConfigView(newConfigView);
      if (spansView) {
        spansView.setConfigView(newConfigView);
      }
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
  }, [
    canvasPoolManager,
    flamegraphCanvas,
    flamegraphView,
    scheduler,
    spansCanvas,
    spansView,
  ]);

  const minimapCanvases = useMemo(() => {
    return [flamegraphMiniMapCanvasRef, flamegraphMiniMapOverlayCanvasRef];
  }, [flamegraphMiniMapCanvasRef, flamegraphMiniMapOverlayCanvasRef]);

  useResizeCanvasObserver(
    minimapCanvases,
    canvasPoolManager,
    flamegraphMiniMapCanvas,
    null
  );

  const spansCanvases = useMemo(() => {
    return [spansCanvasRef];
  }, [spansCanvasRef]);

  const spansCanvasBounds = useResizeCanvasObserver(
    spansCanvases,
    canvasPoolManager,
    spansCanvas,
    spansView
  );

  const flamegraphCanvases = useMemo(() => {
    return [flamegraphCanvasRef, flamegraphOverlayCanvasRef];
  }, [flamegraphCanvasRef, flamegraphOverlayCanvasRef]);

  const flamegraphCanvasBounds = useResizeCanvasObserver(
    flamegraphCanvases,
    canvasPoolManager,
    flamegraphCanvas,
    flamegraphView
  );

  const flamegraphRenderer = useMemo(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }

    return new FlamegraphRenderer(flamegraphCanvasRef, flamegraph, flamegraphTheme, {
      draw_border: true,
    });
  }, [flamegraph, flamegraphCanvasRef, flamegraphTheme]);

  const getFrameColor = useCallback(
    (frame: FlamegraphFrame) => {
      if (!flamegraphRenderer) {
        return '';
      }
      return formatColorForFrame(frame, flamegraphRenderer);
    },
    [flamegraphRenderer]
  );

  // referenceNode is passed down to the flamegraphdrawer and is used to determine
  // the weights of each frame. In other words, in case there is no user selected root, then all
  // of the frame weights and timing are relative to the entire profile. If there is a user selected
  // root however, all weights are relative to that sub tree.
  const referenceNode = useMemo(
    () => (selectedRoot ? selectedRoot : flamegraph.root),
    [selectedRoot, flamegraph.root]
  );

  // In case a user selected root is present, we will display that root + it's entire sub tree.
  // If no root is selected, we will display the entire sub tree down from the root. We start at
  // root.children because flamegraph.root is a virtual node that we do not want to show in the table.
  const rootNodes = useMemo(() => {
    return selectedRoot ? [selectedRoot] : flamegraph.root.children;
  }, [selectedRoot, flamegraph.root]);

  const onSortingChange: FlamegraphViewSelectMenuProps['onSortingChange'] = useCallback(
    newSorting => {
      dispatch({type: 'set sorting', payload: newSorting});
    },
    [dispatch]
  );

  const onViewChange: FlamegraphViewSelectMenuProps['onViewChange'] = useCallback(
    newView => {
      dispatch({type: 'set view', payload: newView});
    },
    [dispatch]
  );

  const onThreadIdChange: FlamegraphThreadSelectorProps['onThreadIdChange'] = useCallback(
    newThreadId => {
      dispatch({type: 'set thread id', payload: newThreadId});
    },
    [dispatch]
  );

  // A bit unfortunate for now, but the search component accepts a list
  // of model to search through. This will become useful as we  build
  // differential flamecharts or start comparing different profiles/charts
  const flamegraphs = useMemo(() => [flamegraph], [flamegraph]);
  return (
    <Fragment>
      <FlamegraphToolbar>
        <FlamegraphThreadSelector
          profileGroup={props.profiles}
          threadId={threadId}
          onThreadIdChange={onThreadIdChange}
        />
        <FlamegraphViewSelectMenu
          view={view}
          sorting={sorting}
          onSortingChange={onSortingChange}
          onViewChange={onViewChange}
        />
        <FlamegraphSearch
          flamegraphs={flamegraphs}
          canvasPoolManager={canvasPoolManager}
        />
        <FlamegraphOptionsMenu canvasPoolManager={canvasPoolManager} />
      </FlamegraphToolbar>

      <FlamegraphLayout
        spans={
          spanChart ? (
            <FlamegraphSpans
              canvasBounds={spansCanvasBounds}
              spanChart={spanChart}
              spansCanvas={spansCanvas}
              spansCanvasRef={spansCanvasRef}
              setSpansCanvasRef={setSpansCanvasRef}
              canvasPoolManager={canvasPoolManager}
              spansView={spansView}
            />
          ) : null
        }
        minimap={
          <FlamegraphZoomViewMinimap
            canvasPoolManager={canvasPoolManager}
            flamegraph={flamegraph}
            flamegraphMiniMapCanvas={flamegraphMiniMapCanvas}
            flamegraphMiniMapCanvasRef={flamegraphMiniMapCanvasRef}
            flamegraphMiniMapOverlayCanvasRef={flamegraphMiniMapOverlayCanvasRef}
            flamegraphMiniMapView={flamegraphView}
            setFlamegraphMiniMapCanvasRef={setFlamegraphMiniMapCanvasRef}
            setFlamegraphMiniMapOverlayCanvasRef={setFlamegraphMiniMapOverlayCanvasRef}
          />
        }
        flamegraph={
          <ProfileDragDropImport onImport={props.onImport}>
            <FlamegraphWarnings flamegraph={flamegraph} />
            <FlamegraphZoomView
              canvasBounds={flamegraphCanvasBounds}
              canvasPoolManager={canvasPoolManager}
              flamegraph={flamegraph}
              flamegraphRenderer={flamegraphRenderer}
              flamegraphCanvas={flamegraphCanvas}
              flamegraphCanvasRef={flamegraphCanvasRef}
              flamegraphOverlayCanvasRef={flamegraphOverlayCanvasRef}
              flamegraphView={flamegraphView}
              setFlamegraphCanvasRef={setFlamegraphCanvasRef}
              setFlamegraphOverlayCanvasRef={setFlamegraphOverlayCanvasRef}
            />
          </ProfileDragDropImport>
        }
        flamegraphDrawer={
          <FlamegraphDrawer
            profileGroup={props.profiles}
            getFrameColor={getFrameColor}
            referenceNode={referenceNode}
            rootNodes={rootNodes}
            flamegraph={flamegraph}
            formatDuration={flamegraph ? flamegraph.formatter : noopFormatDuration}
            canvasPoolManager={canvasPoolManager}
            canvasScheduler={scheduler}
          />
        }
      />
    </Fragment>
  );
}

export {Flamegraph};
