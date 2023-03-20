import {
  Fragment,
  ReactElement,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {mat3, vec2} from 'gl-matrix';

import {Button} from 'sentry/components/button';
import {FlamegraphZoomView} from 'sentry/components/profiling/flamegraph/flamegraphZoomView';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import {FlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphProfiles';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useFlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphProfiles';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphZoomPosition} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphZoomPosition';
import {
  useFlamegraphTheme,
  useMutateFlamegraphTheme,
} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {
  computeConfigViewWithStrategy,
  computeMinZoomConfigViewForFrames,
  Rect,
  useResizeCanvasObserver,
} from 'sentry/utils/profiling/gl/utils';
import {FlamegraphRendererWebGL} from 'sentry/utils/profiling/renderers/flamegraphRendererWebGL';
import {useDevicePixelRatio} from 'sentry/utils/useDevicePixelRatio';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

type FlamegraphCandidate = {
  frame: FlamegraphFrame;
  threadId: number;
  isActiveThread?: boolean; // this is the thread referred to by the active profile index
};

function findLongestMatchingFrame(
  flamegraph: FlamegraphModel,
  focusFrame: FlamegraphProfiles['highlightFrames']
): FlamegraphFrame | null {
  if (focusFrame === null) {
    return null;
  }

  let longestFrame: FlamegraphFrame | null = null;

  const frames: FlamegraphFrame[] = [...flamegraph.root.children];
  while (frames.length > 0) {
    const frame = frames.pop()!;
    if (
      focusFrame.name === frame.frame.name &&
      focusFrame.package === frame.frame.image &&
      (longestFrame?.node?.totalWeight || 0) < frame.node.totalWeight
    ) {
      longestFrame = frame;
    }

    if (longestFrame && longestFrame.node.totalWeight < frame.node.totalWeight) {
      for (let i = 0; i < frame.children.length; i++) {
        frames.push(frame.children[i]);
      }
    }
  }

  return longestFrame;
}

const LOADING_OR_FALLBACK_FLAMEGRAPH = FlamegraphModel.Empty();

export function AggregateFlamegraph(): ReactElement {
  const devicePixelRatio = useDevicePixelRatio();
  const dispatch = useDispatchFlamegraphState();

  const profileGroup = useProfileGroup();

  const flamegraphTheme = useFlamegraphTheme();
  const setFlamegraphThemeMutation = useMutateFlamegraphTheme();
  const position = useFlamegraphZoomPosition();
  const profiles = useFlamegraphProfiles();
  const {colorCoding, sorting, view} = useFlamegraphPreferences();
  const {threadId, highlightFrames} = profiles;

  const [flamegraphCanvasRef, setFlamegraphCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphOverlayCanvasRef, setFlamegraphOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const profile = useMemo(() => {
    return profileGroup.profiles.find(p => p.threadId === threadId);
  }, [profileGroup, threadId]);

  const flamegraph = useMemo(() => {
    if (typeof threadId !== 'number') {
      return LOADING_OR_FALLBACK_FLAMEGRAPH;
    }

    // This could happen if threadId was initialized from query string, but for some
    // reason the profile was removed from the list of profiles.
    if (!profile) {
      return LOADING_OR_FALLBACK_FLAMEGRAPH;
    }

    const transaction = Sentry.startTransaction({
      op: 'import',
      name: 'flamegraph.constructor',
    });

    transaction.setTag('sorting', sorting.split(' ').join('_'));
    transaction.setTag('view', view.split(' ').join('_'));

    const newFlamegraph = new FlamegraphModel(profile, threadId, {
      inverted: view === 'bottom up',
      sort: sorting,
      configSpace: undefined,
    });
    transaction.finish();

    return newFlamegraph;
  }, [profile, sorting, threadId, view]);

  const flamegraphCanvas = useMemo(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }
    const yOrigin = flamegraphTheme.SIZES.TIMELINE_HEIGHT * devicePixelRatio;
    return new FlamegraphCanvas(flamegraphCanvasRef, vec2.fromValues(0, yOrigin));
  }, [devicePixelRatio, flamegraphCanvasRef, flamegraphTheme]);

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
          configSpaceTransform: undefined,
        },
      });

      if (defined(highlightFrames)) {
        const frames = flamegraph.findAllMatchingFrames(
          highlightFrames.name,
          highlightFrames.package
        );

        if (frames.length > 0) {
          const rectFrames = frames.map(
            f => new Rect(f.start, f.depth, f.end - f.start, 1)
          );
          const newConfigView = computeMinZoomConfigViewForFrames(
            newView.configView,
            rectFrames
          );
          newView.setConfigView(newConfigView);
          return newView;
        }
      }

      // Because we render empty flamechart while we fetch the data, we need to make sure
      // to have some heuristic when the data is fetched to determine if we should
      // initialize the config view to the full view or a predefined value
      else if (
        !defined(highlightFrames) &&
        position.view &&
        !position.view.isEmpty() &&
        previousView?.model === LOADING_OR_FALLBACK_FLAMEGRAPH
      ) {
        // We allow min width to be initialize to lower than view.minWidth because
        // there is a chance that user zoomed into a span duration which may have been updated
        // after the model was loaded (see L320)
        newView.setConfigView(position.view, {width: {min: 0}});
      }

      return newView;
    },

    // We skip position.view dependency because it will go into an infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [flamegraph, flamegraphCanvas, flamegraphTheme]
  );

  useEffect(() => {
    const canvasHeight = flamegraphCanvas?.logicalSpace.height;
    if (!canvasHeight) {
      return;
    }

    setFlamegraphThemeMutation(theme => {
      const flamegraphFitTo = canvasHeight / flamegraph.depth;
      const minReadableRatio = 0.8; // this is quite small
      const fitToRatio = flamegraphFitTo / theme.SIZES.BAR_HEIGHT;
      const barHeightRatio = Math.min(Math.max(minReadableRatio, fitToRatio), 1);

      // reduce the offset to leave just enough space for the toolbar
      theme.SIZES.FLAMEGRAPH_DEPTH_OFFSET = 2.5;
      theme.SIZES.BAR_HEIGHT = theme.SIZES.BAR_HEIGHT * barHeightRatio;
      theme.SIZES.BAR_FONT_SIZE = theme.SIZES.BAR_FONT_SIZE * barHeightRatio;
      return theme;
    });

    // We skip `flamegraphCanvas` as it causes an infinite loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flamegraph, setFlamegraphThemeMutation]);

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

  const flamegraphRenderer = useMemo(() => {
    if (!flamegraphCanvasRef) {
      return null;
    }

    return new FlamegraphRendererWebGL(flamegraphCanvasRef, flamegraph, flamegraphTheme, {
      colorCoding,
      draw_border: true,
    });
  }, [colorCoding, flamegraph, flamegraphCanvasRef, flamegraphTheme]);

  useEffect(() => {
    if (defined(profiles.threadId)) {
      return;
    }
    const threadID =
      typeof profileGroup.activeProfileIndex === 'number'
        ? profileGroup.profiles[profileGroup.activeProfileIndex]?.threadId
        : null;

    // if the state has a highlight frame specified, then we want to jump to the
    // thread containing it, highlight the frames on the thread, and change the
    // view so it's obvious where it is
    if (highlightFrames) {
      const candidate = profileGroup.profiles.reduce<FlamegraphCandidate | null>(
        (prevCandidate, currentProfile) => {
          // if the previous candidate is the active thread, it always takes priority
          if (prevCandidate?.isActiveThread) {
            return prevCandidate;
          }

          const graph = new FlamegraphModel(currentProfile, currentProfile.threadId, {
            inverted: false,
            sort: sorting,
            configSpace: undefined,
          });

          const frame = findLongestMatchingFrame(graph, highlightFrames);

          if (!defined(frame)) {
            return prevCandidate;
          }

          const newScore = frame.node.totalWeight || 0;
          const oldScore = prevCandidate?.frame?.node?.totalWeight || 0;

          // if we find the frame on the active thread, it always takes priority
          if (newScore > 0 && currentProfile.threadId === threadID) {
            return {
              frame,
              threadId: currentProfile.threadId,
              isActiveThread: true,
            };
          }

          return newScore <= oldScore
            ? prevCandidate
            : {
                frame,
                threadId: currentProfile.threadId,
              };
        },
        null
      );

      if (defined(candidate)) {
        dispatch({
          type: 'set thread id',
          payload: candidate.threadId,
        });
        return;
      }
    }

    // fall back case, when we finally load the active profile index from the profile,
    // make sure we update the thread id so that it is show first
    if (defined(threadID)) {
      dispatch({
        type: 'set thread id',
        payload: threadID,
      });
    }
  }, [profileGroup, highlightFrames, profiles.threadId, dispatch, sorting]);

  return (
    <Fragment>
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
        disablePanX
        disableZoom
        disableGrid
        disableCallOrderSort
      />
      <AggregateFlamegraphToolbar>
        <Button size="xs" onClick={() => scheduler.dispatch('reset zoom')}>
          {t('Reset Zoom')}
        </Button>
      </AggregateFlamegraphToolbar>
    </Fragment>
  );
}

const AggregateFlamegraphToolbar = styled('div')`
  position: absolute;
  left: 0;
  top: 0;
  padding: ${space(1)};
  padding-left: ${space(1)};
  background-color: rgba(255, 255, 255, 0.6);
  width: 100%;
`;
