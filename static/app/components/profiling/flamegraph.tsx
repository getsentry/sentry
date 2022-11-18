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

import {FlamegraphOptionsMenu} from 'sentry/components/profiling/flamegraphOptionsMenu';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraphSearch';
import {FlamegraphToolbar} from 'sentry/components/profiling/flamegraphToolbar';
import {FlamegraphViewSelectMenu} from 'sentry/components/profiling/flamegraphViewSelectMenu';
import {FlamegraphZoomView} from 'sentry/components/profiling/flamegraphZoomView';
import {FlamegraphZoomViewMinimap} from 'sentry/components/profiling/flamegraphZoomViewMinimap';
import {FrameStack} from 'sentry/components/profiling/FrameStack/frameStack';
import {
  ProfileDragDropImport,
  ProfileDragDropImportProps,
} from 'sentry/components/profiling/profileDragDropImport';
import {ThreadMenuSelector} from 'sentry/components/profiling/threadSelector';
import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useFlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphProfiles';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphZoomPosition} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphZoomPosition';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {FlamegraphView} from 'sentry/utils/profiling/flamegraphView';
import {
  computeConfigViewWithStategy,
  formatColorForFrame,
  Rect,
  watchForResize,
} from 'sentry/utils/profiling/gl/utils';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {FlamegraphRenderer} from 'sentry/utils/profiling/renderers/flamegraphRenderer';
import {formatTo, ProfilingFormatterUnit} from 'sentry/utils/profiling/units/units';
import {useDevicePixelRatio} from 'sentry/utils/useDevicePixelRatio';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';

import {FlamegraphWarnings} from './FlamegraphWarnings';
import {ProfilingFlamechartLayout} from './profilingFlamechartLayout';

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
}

function Flamegraph(props: FlamegraphProps): ReactElement {
  const [canvasBounds, setCanvasBounds] = useState<Rect>(Rect.Empty());
  const devicePixelRatio = useDevicePixelRatio();
  const dispatch = useDispatchFlamegraphState();

  const flamegraphTheme = useFlamegraphTheme();
  const position = useFlamegraphZoomPosition();
  const {sorting, view, xAxis} = useFlamegraphPreferences();
  const {threadId, selectedRoot} = useFlamegraphProfiles();

  const [flamegraphCanvasRef, setFlamegraphCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphOverlayCanvasRef, setFlamegraphOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const [flamegraphMiniMapCanvasRef, setFlamegraphMiniMapCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphMiniMapOverlayCanvasRef, setFlamegraphMiniMapOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useMemo(() => new CanvasScheduler(), []);

  const flamegraph = useMemo(() => {
    if (typeof threadId !== 'number') {
      return FALLBACK_FLAMEGRAPH;
    }

    // This could happen if threadId was initialized from query string, but for some
    // reason the profile was removed from the list of profiles.
    const profile = props.profiles.profiles.find(p => p.threadId === threadId);
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
  }, [props.profiles, sorting, threadId, view, xAxis]);

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

  const flamegraphView = useMemoWithPrevious<FlamegraphView | null>(
    previousView => {
      if (!flamegraphCanvas) {
        return null;
      }

      const newView = new FlamegraphView({
        canvas: flamegraphCanvas,
        flamegraph,
        theme: flamegraphTheme,
      });

      // if the profile or the config space of the flamegraph has changed, we do not
      // want to persist the config view. This is to avoid a case where the new config space
      // is larger than the previous one, meaning the new view could now be zoomed in even
      // though the user did not fire any zoom events.
      if (
        previousView?.flamegraph.profile === newView.flamegraph.profile &&
        previousView.configSpace.equals(newView.configSpace)
      ) {
        // if we're still looking at the same profile but only a preference other than
        // left heavy has changed, we do want to persist the config view
        if (previousView.flamegraph.leftHeavy === newView.flamegraph.leftHeavy) {
          newView.setConfigView(
            previousView.configView.withHeight(newView.configView.height)
          );
        }
      }

      // Because we render empty flamechart while we fetch the data, we need to make sure
      // to have some heuristic when the data is fetched to determine if we should
      // initialize the config view to the full view or a predefined value
      if (position.view && previousView?.flamegraph === FALLBACK_FLAMEGRAPH) {
        newView.setConfigView(position.view);
      }

      return newView;
    },
    // We skip position.view dependency because it will go into an infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flamegraph, flamegraphTheme, flamegraphCanvas]
  );

  useEffect(() => {
    if (!flamegraphCanvas || !flamegraphView) {
      return undefined;
    }

    const onConfigViewChange = (rect: Rect) => {
      flamegraphView.setConfigView(rect);
      canvasPoolManager.draw();
    };

    const onTransformConfigView = (mat: mat3) => {
      flamegraphView.transformConfigView(mat);
      canvasPoolManager.draw();
    };

    const onResetZoom = () => {
      flamegraphView.resetConfigView(flamegraphCanvas);
      canvasPoolManager.draw();
    };

    const onZoomIntoFrame = (frame: FlamegraphFrame, strategy: 'min' | 'exact') => {
      const newConfigView = computeConfigViewWithStategy(
        strategy,
        flamegraphView.configView,
        new Rect(frame.start, frame.depth, frame.end - frame.start, 1)
      );

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

  useEffect(() => {
    canvasPoolManager.registerScheduler(scheduler);
    return () => canvasPoolManager.unregisterScheduler(scheduler);
  }, [canvasPoolManager, scheduler]);

  useLayoutEffect(() => {
    if (
      !flamegraphView ||
      !flamegraphCanvas ||
      !flamegraphMiniMapCanvas ||
      !flamegraphCanvasRef ||
      !flamegraphOverlayCanvasRef ||
      !flamegraphMiniMapCanvasRef ||
      !flamegraphMiniMapOverlayCanvasRef
    ) {
      return undefined;
    }

    const flamegraphObserver = watchForResize(
      [flamegraphCanvasRef, flamegraphOverlayCanvasRef],
      () => {
        const bounds = flamegraphCanvasRef.getBoundingClientRect();
        setCanvasBounds(new Rect(bounds.x, bounds.y, bounds.width, bounds.height));

        flamegraphCanvas.initPhysicalSpace();
        flamegraphView.resizeConfigSpace(flamegraphCanvas);

        canvasPoolManager.drawSync();
      }
    );

    const flamegraphMiniMapObserver = watchForResize(
      [flamegraphMiniMapCanvasRef, flamegraphMiniMapOverlayCanvasRef],
      () => {
        flamegraphMiniMapCanvas.initPhysicalSpace();

        canvasPoolManager.drawSync();
      }
    );

    return () => {
      flamegraphObserver.disconnect();
      flamegraphMiniMapObserver.disconnect();
    };
  }, [
    canvasPoolManager,
    flamegraphCanvas,
    flamegraphCanvasRef,
    flamegraphMiniMapCanvas,
    flamegraphMiniMapCanvasRef,
    flamegraphMiniMapOverlayCanvasRef,
    flamegraphOverlayCanvasRef,
    flamegraphView,
  ]);

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

  // referenceNode is passed down to the frameStack and is used to determine
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

  return (
    <Fragment>
      <FlamegraphToolbar>
        <ThreadMenuSelector
          profileGroup={props.profiles}
          threadId={threadId}
          onThreadIdChange={newThreadId =>
            dispatch({type: 'set thread id', payload: newThreadId})
          }
        />
        <FlamegraphViewSelectMenu
          view={view}
          sorting={sorting}
          onSortingChange={s => {
            dispatch({type: 'set sorting', payload: s});
          }}
          onViewChange={v => {
            dispatch({type: 'set view', payload: v});
          }}
        />
        <FlamegraphSearch
          flamegraphs={[flamegraph]}
          canvasPoolManager={canvasPoolManager}
        />
        <FlamegraphOptionsMenu canvasPoolManager={canvasPoolManager} />
      </FlamegraphToolbar>

      <ProfilingFlamechartLayout
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
        flamechart={
          <ProfileDragDropImport onImport={props.onImport}>
            <FlamegraphWarnings flamegraph={flamegraph} />
            <FlamegraphZoomView
              flamegraphRenderer={flamegraphRenderer}
              canvasBounds={canvasBounds}
              canvasPoolManager={canvasPoolManager}
              flamegraph={flamegraph}
              flamegraphCanvas={flamegraphCanvas}
              flamegraphCanvasRef={flamegraphCanvasRef}
              flamegraphOverlayCanvasRef={flamegraphOverlayCanvasRef}
              flamegraphView={flamegraphView}
              setFlamegraphCanvasRef={setFlamegraphCanvasRef}
              setFlamegraphOverlayCanvasRef={setFlamegraphOverlayCanvasRef}
            />
          </ProfileDragDropImport>
        }
        frameStack={
          <FrameStack
            profileGroup={props.profiles}
            flamegraph={flamegraph}
            referenceNode={referenceNode}
            rootNodes={rootNodes}
            getFrameColor={getFrameColor}
            formatDuration={flamegraph ? flamegraph.formatter : noopFormatDuration}
            canvasPoolManager={canvasPoolManager}
          />
        }
      />
    </Fragment>
  );
}

export {Flamegraph};
