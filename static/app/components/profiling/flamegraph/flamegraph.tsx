import {
  Fragment,
  ReactElement,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import {mat3, vec2} from 'gl-matrix';

import {ProfileDragDropImport} from 'sentry/components/profiling/flamegraph/flamegraphOverlays/profileDragDropImport';
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
import {EntryType, EventTransaction} from 'sentry/types';
import {EntrySpans} from 'sentry/types/event';
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
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {
  computeConfigViewWithStrategy,
  computeMinZoomConfigViewForFrames,
  formatColorForFrame,
  Rect,
  useResizeCanvasObserver,
} from 'sentry/utils/profiling/gl/utils';
import {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {FlamegraphRendererWebGL} from 'sentry/utils/profiling/renderers/flamegraphRendererWebGL';
import {SpanChart, SpanChartNode} from 'sentry/utils/profiling/spanChart';
import {SpanTree} from 'sentry/utils/profiling/spanTree';
import {UIFrames} from 'sentry/utils/profiling/uiFrames';
import {formatTo, ProfilingFormatterUnit} from 'sentry/utils/profiling/units/units';
import {useDevicePixelRatio} from 'sentry/utils/useDevicePixelRatio';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';
import useOrganization from 'sentry/utils/useOrganization';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';
import {
  useProfileTransaction,
  useSetProfiles,
} from 'sentry/views/profiling/profilesProvider';

import {FlamegraphDrawer} from './flamegraphDrawer/flamegraphDrawer';
import {FlamegraphWarnings} from './flamegraphOverlays/FlamegraphWarnings';
import {useViewKeyboardNavigation} from './interactions/useViewKeyboardNavigation';
import {FlamegraphLayout} from './flamegraphLayout';
import {FlamegraphSpans} from './flamegraphSpans';
import {FlamegraphUIFrames} from './flamegraphUIFrames';

function getTransactionConfigSpace(
  profileGroup: ProfileGroup,
  transaction: EventTransaction | null,
  unit: ProfilingFormatterUnit | string
): Rect {
  // We have a transaction, so we should do our best to align the profile
  // with the transaction's timeline.
  if (transaction) {
    // TODO: Adjust the alignment based on the profile's timestamp if it does
    // not match the transaction's start timestamp
    const duration = transaction.endTimestamp - transaction.startTimestamp;
    return new Rect(0, 0, formatTo(duration, 'seconds', unit), 0);
  }

  // No transaction was found, so best we can do is align it to the starting
  // position of the profiles
  const duration = profileGroup.metadata.durationNS;

  // If durationNs is present, use it
  if (typeof duration === 'number') {
    return new Rect(0, 0, formatTo(duration, 'nanoseconds', unit), 0);
  }

  // else fallback to Math.max of profile durations
  const maxProfileDuration = Math.max(...profileGroup.profiles.map(p => p.duration));
  return new Rect(0, 0, maxProfileDuration, 0);
}

function collectAllSpanEntriesFromTransaction(
  transaction: EventTransaction
): EntrySpans['data'] {
  if (!transaction.entries.length) {
    return [];
  }

  const spans = transaction.entries.filter(
    (e): e is EntrySpans => e.type === EntryType.SPANS
  );

  let allSpans: EntrySpans['data'] = [];

  for (const span of spans) {
    allSpans = allSpans.concat(span.data);
  }

  return allSpans;
}

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
      // the image name on a frame is optional treat it the same as the empty string
      (focusFrame.package === (frame.frame.package || '') ||
        focusFrame.package === (frame.frame.module || '')) &&
      (longestFrame?.node?.totalWeight || 0) < frame.node.totalWeight
    ) {
      longestFrame = frame;
    }

    for (let i = 0; i < frame.children.length; i++) {
      frames.push(frame.children[i]);
    }
  }

  return longestFrame;
}

const LOADING_OR_FALLBACK_FLAMEGRAPH = FlamegraphModel.Empty();
const LOADING_OR_FALLBACK_SPAN_TREE = SpanTree.Empty;
const LOADING_OR_FALLBACK_UIFRAMES = UIFrames.Empty;

const noopFormatDuration = () => '';

function Flamegraph(): ReactElement {
  const organization = useOrganization();
  const devicePixelRatio = useDevicePixelRatio();
  const profiledTransaction = useProfileTransaction();
  const dispatch = useDispatchFlamegraphState();

  const setProfiles = useSetProfiles();
  const profileGroup = useProfileGroup();

  const flamegraphTheme = useFlamegraphTheme();
  const position = useFlamegraphZoomPosition();
  const profiles = useFlamegraphProfiles();
  const {colorCoding, sorting, view} = useFlamegraphPreferences();
  const {threadId, selectedRoot, highlightFrames} = useFlamegraphProfiles();

  const [flamegraphCanvasRef, setFlamegraphCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphOverlayCanvasRef, setFlamegraphOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const [flamegraphMiniMapCanvasRef, setFlamegraphMiniMapCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [flamegraphMiniMapOverlayCanvasRef, setFlamegraphMiniMapOverlayCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const [spansCanvasRef, setSpansCanvasRef] = useState<HTMLCanvasElement | null>(null);
  const [uiFramesCanvasRef, setUIFramesCanvasRef] = useState<HTMLCanvasElement | null>(
    null
  );

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const hasUIFrames = useMemo(() => {
    const platform = profileGroup.metadata.platform;
    return (
      (platform === 'cocoa' || platform === 'android') &&
      organization.features.includes('profiling-ui-frames')
    );
  }, [organization.features, profileGroup.metadata.platform]);

  const profile = useMemo(() => {
    return profileGroup.profiles.find(p => p.threadId === threadId);
  }, [profileGroup, threadId]);

  const spanTree: SpanTree = useMemo(() => {
    if (profiledTransaction.type === 'resolved' && profiledTransaction.data) {
      return new SpanTree(
        profiledTransaction.data,
        collectAllSpanEntriesFromTransaction(profiledTransaction.data)
      );
    }

    return LOADING_OR_FALLBACK_SPAN_TREE;
  }, [profiledTransaction]);

  const spanChart = useMemo(() => {
    if (!profile) {
      return null;
    }

    return new SpanChart(spanTree, {unit: profile.unit});
  }, [spanTree, profile]);

  const flamegraph = useMemo(() => {
    if (typeof threadId !== 'number') {
      return LOADING_OR_FALLBACK_FLAMEGRAPH;
    }

    // This could happen if threadId was initialized from query string, but for some
    // reason the profile was removed from the list of profiles.
    if (!profile) {
      return LOADING_OR_FALLBACK_FLAMEGRAPH;
    }

    // Wait for the transaction to finish loading, regardless of the results.
    // Otherwise, the rendered profile will probably shift once the transaction loads.
    if (
      profiledTransaction.type === 'loading' ||
      profiledTransaction.type === 'initial'
    ) {
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
      configSpace: getTransactionConfigSpace(
        profileGroup,
        profiledTransaction.type === 'resolved' ? profiledTransaction.data : null,
        profile.unit
      ),
    });
    transaction.finish();

    return newFlamegraph;
  }, [profile, profileGroup, profiledTransaction, sorting, threadId, view]);

  const uiFrames = useMemo(() => {
    if (!hasUIFrames) {
      return LOADING_OR_FALLBACK_UIFRAMES;
    }
    return new UIFrames(
      {
        slow: profileGroup.measurements?.slow_frame_renders,
        frozen: profileGroup.measurements?.frozen_frame_renders,
      },
      {unit: flamegraph.profile.unit},
      flamegraph.configSpace.withHeight(1)
    );
  }, [
    profileGroup.measurements,
    flamegraph.profile.unit,
    flamegraph.configSpace,
    hasUIFrames,
  ]);

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

  const uiFramesCanvas = useMemo(() => {
    if (!uiFramesCanvasRef) {
      return null;
    }
    return new FlamegraphCanvas(uiFramesCanvasRef, vec2.fromValues(0, 0));
  }, [uiFramesCanvasRef]);

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
          configSpaceTransform: new Rect(flamegraph.profile.startedAt, 0, 0, 0),
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
          previousView.model.sort === 'left heavy' &&
          newView.model.sort === 'left heavy'
        ) {
          newView.setConfigView(
            previousView.configView.withHeight(newView.configView.height)
          );
        }
      }

      if (defined(highlightFrames)) {
        let frames = flamegraph.findAllMatchingFrames(
          highlightFrames.name,
          highlightFrames.package
        );

        if (
          !frames.length &&
          !highlightFrames.package &&
          highlightFrames.name &&
          profileGroup.metadata.platform === 'node'
        ) {
          // there is a chance that the reason we did not find any frames is because
          // for node, we try to infer some package from the frontend code.
          // If that happens, we'll try and just do a search by name. This logic
          // is duplicated in flamegraphZoomView.tsx and should be kept in sync
          frames = flamegraph.findAllMatchingFramesBy(highlightFrames.name, ['name']);
        }

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

  const uiFramesView = useMemoWithPrevious<CanvasView<UIFrames> | null>(
    _previousView => {
      if (!flamegraphView || !flamegraphCanvas || !uiFrames) {
        return null;
      }

      const newView = new CanvasView({
        canvas: flamegraphCanvas,
        model: uiFrames,
        mode: 'stretchToFit',
        options: {
          inverted: flamegraph.inverted,
          minWidth: uiFrames.minFrameDuration,
          barHeight: 10,
          depthOffset: 0,
          configSpaceTransform: new Rect(flamegraph.profile.startedAt, 0, 0, 0),
        },
      });

      // Initialize configView to whatever the flamegraph configView is
      newView.setConfigView(
        flamegraphView.configView.withHeight(newView.configView.height),
        {width: {min: 0}}
      );

      return newView;
    },
    [flamegraphView, flamegraphCanvas, flamegraph, uiFrames]
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
          inverted: flamegraph.inverted,
          minWidth: spanChart.minSpanDuration,
          barHeight: flamegraphTheme.SIZES.SPANS_BAR_HEIGHT,
          depthOffset: flamegraphTheme.SIZES.SPANS_DEPTH_OFFSET,
        },
      });

      // Initialize configView to whatever the flamegraph configView is
      newView.setConfigView(flamegraphView.configView, {width: {min: 0}});
      return newView;
    },
    [spanChart, spansCanvas, flamegraph.inverted, flamegraphView, flamegraphTheme.SIZES]
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

      if (uiFramesView) {
        uiFramesView.setMinWidth(minWidthBetweenViews);
      }
    }
  }, [flamegraphView, spansView, uiFramesView]);

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
        if (uiFramesView) {
          uiFramesView.setConfigView(rect);
        }
      }

      if (sourceConfigViewChange === spansView) {
        spansView.setConfigView(rect.withHeight(spansView.configView.height));
        const beforeY = flamegraphView.configView.y;
        flamegraphView.setConfigView(
          rect.withHeight(flamegraphView.configView.height).withY(beforeY)
        );
        if (uiFramesView) {
          uiFramesView.setConfigView(rect);
        }
      }
      canvasPoolManager.draw();
    };

    const onTransformConfigView = (
      mat: mat3,
      sourceTransformConfigView: CanvasView<any>
    ) => {
      if (
        sourceTransformConfigView === flamegraphView ||
        sourceTransformConfigView === uiFramesView
      ) {
        flamegraphView.transformConfigView(mat);
        if (spansView) {
          const beforeY = spansView.configView.y;
          spansView.transformConfigView(mat);
          spansView.setConfigView(spansView.configView.withY(beforeY));
        }
        if (uiFramesView) {
          uiFramesView.transformConfigView(mat);
        }
      }

      if (sourceTransformConfigView === spansView) {
        spansView.transformConfigView(mat);
        const beforeY = flamegraphView.configView.y;
        flamegraphView.transformConfigView(mat);
        flamegraphView.setConfigView(flamegraphView.configView.withY(beforeY));
        if (uiFramesView) {
          uiFramesView.transformConfigView(mat);
        }
      }

      canvasPoolManager.draw();
    };

    const onResetZoom = () => {
      flamegraphView.resetConfigView(flamegraphCanvas);
      if (spansView && spansCanvas) {
        spansView.resetConfigView(spansCanvas);
      }
      if (uiFramesView && uiFramesCanvas) {
        uiFramesView.resetConfigView(uiFramesCanvas);
      }
      canvasPoolManager.draw();
    };

    const onZoomIntoFrame = (frame: FlamegraphFrame, strategy: 'min' | 'exact') => {
      const newConfigView = computeConfigViewWithStrategy(
        strategy,
        flamegraphView.configView,
        new Rect(frame.start, frame.depth, frame.end - frame.start, 1)
      ).transformRect(flamegraphView.configSpaceTransform);

      flamegraphView.setConfigView(newConfigView);
      if (spansView) {
        spansView.setConfigView(newConfigView.withHeight(spansView.configView.height));
      }
      if (uiFramesView) {
        uiFramesView.setConfigView(
          newConfigView.withHeight(uiFramesView.configView.height)
        );
      }
      canvasPoolManager.draw();
    };

    const onZoomIntoSpan = (span: SpanChartNode, strategy: 'min' | 'exact') => {
      if (!spansView) {
        return;
      }
      const newConfigView = computeConfigViewWithStrategy(
        strategy,
        flamegraphView.configView,
        new Rect(span.start, span.depth, span.end - span.start, 1)
      ).transformRect(spansView.configSpaceTransform);

      spansView.setConfigView(newConfigView);
      if (uiFramesView) {
        uiFramesView.setConfigView(
          newConfigView.withHeight(uiFramesView.configView.height)
        );
      }
      flamegraphView.setConfigView(
        newConfigView.withHeight(flamegraphView.configView.height)
      );
      canvasPoolManager.draw();
    };

    scheduler.on('set config view', onConfigViewChange);
    scheduler.on('transform config view', onTransformConfigView);
    scheduler.on('reset zoom', onResetZoom);
    scheduler.on('zoom at frame', onZoomIntoFrame);
    scheduler.on('zoom at span', onZoomIntoSpan);

    return () => {
      scheduler.off('set config view', onConfigViewChange);
      scheduler.off('transform config view', onTransformConfigView);
      scheduler.off('reset zoom', onResetZoom);
      scheduler.off('zoom at frame', onZoomIntoFrame);
      scheduler.off('zoom at span', onZoomIntoSpan);
    };
  }, [
    canvasPoolManager,
    flamegraphCanvas,
    flamegraphView,
    scheduler,
    spansCanvas,
    spansView,
    uiFramesCanvas,
    uiFramesView,
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

  const uiFramesCanvases = useMemo(() => {
    return [uiFramesCanvasRef];
  }, [uiFramesCanvasRef]);

  const uiFramesCanvasBounds = useResizeCanvasObserver(
    uiFramesCanvases,
    canvasPoolManager,
    uiFramesCanvas,
    uiFramesView
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

    return new FlamegraphRendererWebGL(flamegraphCanvasRef, flamegraph, flamegraphTheme, {
      colorCoding,
      draw_border: true,
    });
  }, [colorCoding, flamegraph, flamegraphCanvasRef, flamegraphTheme]);

  const getFrameColor = useCallback(
    (frame: FlamegraphFrame) => {
      if (!flamegraphRenderer) {
        return '';
      }
      return formatColorForFrame(frame, flamegraphRenderer);
    },
    [flamegraphRenderer]
  );

  const physicalToConfig =
    flamegraphView && flamegraphCanvas
      ? mat3.invert(
          mat3.create(),
          flamegraphView.fromConfigView(flamegraphCanvas.physicalSpace)
        )
      : mat3.create();

  const configSpacePixel = new Rect(0, 0, 1, 1).transformRect(physicalToConfig);

  // Register keyboard navigation
  useViewKeyboardNavigation(flamegraphView, canvasPoolManager, configSpacePixel.width);

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

  const onImport = useCallback(
    (p: Profiling.ProfileInput) => {
      setProfiles({type: 'resolved', data: p});
    },
    [setProfiles]
  );

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

  // A bit unfortunate for now, but the search component accepts a list
  // of model to search through. This will become useful as we  build
  // differential flamecharts or start comparing different profiles/charts
  const flamegraphs = useMemo(() => [flamegraph], [flamegraph]);
  const spans = useMemo(() => (spanChart ? [spanChart] : []), [spanChart]);

  return (
    <Fragment>
      <FlamegraphToolbar>
        <FlamegraphThreadSelector
          profileGroup={profileGroup}
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
          spans={spans}
          flamegraphs={flamegraphs}
          canvasPoolManager={canvasPoolManager}
        />
        <FlamegraphOptionsMenu canvasPoolManager={canvasPoolManager} />
      </FlamegraphToolbar>

      <FlamegraphLayout
        uiFrames={
          hasUIFrames ? (
            <FlamegraphUIFrames
              canvasBounds={uiFramesCanvasBounds}
              canvasPoolManager={canvasPoolManager}
              setUIFramesCanvasRef={setUIFramesCanvasRef}
              uiFramesCanvasRef={uiFramesCanvasRef}
              uiFramesCanvas={uiFramesCanvas}
              uiFramesView={uiFramesView}
              uiFrames={uiFrames}
            />
          ) : null
        }
        spansTreeDepth={spanChart?.depth}
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
          <ProfileDragDropImport onImport={onImport}>
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
            profileGroup={profileGroup}
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
