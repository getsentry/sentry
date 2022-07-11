import {
  Fragment,
  ReactElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {mat3, vec2} from 'gl-matrix';

import {FlamegraphOptionsMenu} from 'sentry/components/profiling/flamegraphOptionsMenu';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraphSearch';
import {FlamegraphToolbar} from 'sentry/components/profiling/flamegraphToolbar';
import {FlamegraphViewSelectMenu} from 'sentry/components/profiling/flamegraphViewSelectMenu';
import {FlamegraphZoomView} from 'sentry/components/profiling/flamegraphZoomView';
import {FlamegraphZoomViewMinimap} from 'sentry/components/profiling/flamegraphZoomViewMinimap';
import {
  ProfileDragDropImport,
  ProfileDragDropImportProps,
} from 'sentry/components/profiling/profileDragDropImport';
import {ThreadMenuSelector} from 'sentry/components/profiling/threadSelector';
import {CanvasPoolManager, CanvasScheduler} from 'sentry/utils/profiling/canvasScheduler';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {useFlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/useFlamegraphProfiles';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {FlamegraphView} from 'sentry/utils/profiling/flamegraphView';
import {
  computeConfigViewWithStategy,
  Rect,
  watchForResize,
} from 'sentry/utils/profiling/gl/utils';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import {useDevicePixelRatio} from 'sentry/utils/useDevicePixelRatio';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';

import {ProfilingFlamechartLayout} from './profilingFlamechartLayout';

function getTransactionConfigSpace(profiles: Profile[]): Rect {
  const startedAt = Math.min(...profiles.map(p => p.startedAt));
  const endedAt = Math.max(...profiles.map(p => p.endedAt));
  return new Rect(startedAt, 0, endedAt - startedAt, 0);
}
interface FlamegraphProps {
  onImport: ProfileDragDropImportProps['onImport'];
  profiles: ProfileGroup;
}

function Flamegraph(props: FlamegraphProps): ReactElement {
  const devicePixelRatio = useDevicePixelRatio();

  const flamegraphTheme = useFlamegraphTheme();
  const [{sorting, view, xAxis}, dispatch] = useFlamegraphPreferences();
  const [{threadId}, dispatchThreadId] = useFlamegraphProfiles();

  const canvasBounds = useRef<Rect>(Rect.Empty());

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
      return FlamegraphModel.Empty();
    }

    // This could happen if threadId was initialized from query string, but for some
    // reason the profile was removed from the list of profiles.
    const profile = props.profiles.profiles.find(p => p.threadId === threadId);
    if (!profile) {
      return FlamegraphModel.Empty();
    }

    return new FlamegraphModel(profile, threadId, {
      inverted: view === 'bottom up',
      leftHeavy: sorting === 'left heavy',
      configSpace:
        xAxis === 'transaction'
          ? getTransactionConfigSpace(props.profiles.profiles)
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

      return newView;
    },
    [flamegraph, flamegraphCanvas, flamegraphTheme]
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

    scheduler.on('setConfigView', onConfigViewChange);
    scheduler.on('transformConfigView', onTransformConfigView);
    scheduler.on('resetZoom', onResetZoom);
    scheduler.on('zoomIntoFrame', onZoomIntoFrame);

    return () => {
      scheduler.off('setConfigView', onConfigViewChange);
      scheduler.off('transformConfigView', onTransformConfigView);
      scheduler.off('resetZoom', onResetZoom);
      scheduler.off('zoomIntoFrame', onZoomIntoFrame);
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
        canvasBounds.current = new Rect(bounds.x, bounds.y, bounds.width, bounds.height);

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

  return (
    <Fragment>
      <FlamegraphToolbar>
        <ThreadMenuSelector
          profileGroup={props.profiles}
          threadId={threadId}
          onThreadIdChange={newThreadId =>
            dispatchThreadId({type: 'set thread id', payload: newThreadId})
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
        layoutType="minimap_top"
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
            <FlamegraphZoomView
              canvasBounds={canvasBounds.current}
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
      />
    </Fragment>
  );
}

export {Flamegraph};
