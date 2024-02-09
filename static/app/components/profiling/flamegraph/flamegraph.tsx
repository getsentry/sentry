import type {ReactElement} from 'react';
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import * as Sentry from '@sentry/react';
import {mat3, vec2} from 'gl-matrix';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {ProfileDragDropImport} from 'sentry/components/profiling/flamegraph/flamegraphOverlays/profileDragDropImport';
import {FlamegraphOptionsMenu} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphOptionsMenu';
import {FlamegraphSearch} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphSearch';
import type {FlamegraphThreadSelectorProps} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphThreadSelector';
import {FlamegraphThreadSelector} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphThreadSelector';
import {FlamegraphToolbar} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphToolbar';
import type {FlamegraphViewSelectMenuProps} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphViewSelectMenu';
import {FlamegraphViewSelectMenu} from 'sentry/components/profiling/flamegraph/flamegraphToolbar/flamegraphViewSelectMenu';
import {FlamegraphZoomView} from 'sentry/components/profiling/flamegraph/flamegraphZoomView';
import {FlamegraphZoomViewMinimap} from 'sentry/components/profiling/flamegraph/flamegraphZoomViewMinimap';
import {t} from 'sentry/locale';
import type {EventTransaction, RequestState} from 'sentry/types';
import {EntryType} from 'sentry/types';
import type {EntrySpans} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {
  CanvasPoolManager,
  useCanvasScheduler,
} from 'sentry/utils/profiling/canvasScheduler';
import {CanvasView} from 'sentry/utils/profiling/canvasView';
import {Flamegraph as FlamegraphModel} from 'sentry/utils/profiling/flamegraph';
import type {FlamegraphSearch as FlamegraphSearchType} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphSearch';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useFlamegraphProfiles} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphProfiles';
import {useFlamegraphSearch} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphSearch';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphZoomPosition} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphZoomPosition';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {FlamegraphCanvas} from 'sentry/utils/profiling/flamegraphCanvas';
import type {ProfileSeriesMeasurement} from 'sentry/utils/profiling/flamegraphChart';
import {FlamegraphChart as FlamegraphChartModel} from 'sentry/utils/profiling/flamegraphChart';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {
  computeConfigViewWithStrategy,
  computeMinZoomConfigViewForFrames,
  formatColorForFrame,
  initializeFlamegraphRenderer,
  useResizeCanvasObserver,
} from 'sentry/utils/profiling/gl/utils';
import type {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';
import {FlamegraphRenderer2D} from 'sentry/utils/profiling/renderers/flamegraphRenderer2D';
import {FlamegraphRendererWebGL} from 'sentry/utils/profiling/renderers/flamegraphRendererWebGL';
import type {SpanChartNode} from 'sentry/utils/profiling/spanChart';
import {SpanChart} from 'sentry/utils/profiling/spanChart';
import {SpanTree} from 'sentry/utils/profiling/spanTree';
import {Rect} from 'sentry/utils/profiling/speedscope';
import {UIFrames} from 'sentry/utils/profiling/uiFrames';
import type {ProfilingFormatterUnit} from 'sentry/utils/profiling/units/units';
import {formatTo, fromNanoJoulesToWatts} from 'sentry/utils/profiling/units/units';
import {useDevicePixelRatio} from 'sentry/utils/useDevicePixelRatio';
import {useMemoWithPrevious} from 'sentry/utils/useMemoWithPrevious';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';
import {
  useProfileTransaction,
  useSetProfiles,
} from 'sentry/views/profiling/profilesProvider';

import {FlamegraphDrawer} from './flamegraphDrawer/flamegraphDrawer';
import {FlamegraphWarnings} from './flamegraphOverlays/FlamegraphWarnings';
import {useViewKeyboardNavigation} from './interactions/useViewKeyboardNavigation';
import {FlamegraphChart} from './flamegraphChart';
import {FlamegraphLayout} from './flamegraphLayout';
import {FlamegraphSpans} from './flamegraphSpans';
import {FlamegraphUIFrames} from './flamegraphUIFrames';

function getMaxConfigSpace(
  profileGroup: ProfileGroup,
  transaction: EventTransaction | null,
  unit: ProfilingFormatterUnit | string
): Rect {
  // We have a transaction, so we should do our best to align the profile
  // with the transaction's timeline.
  const maxProfileDuration = Math.max(...profileGroup.profiles.map(p => p.duration));
  if (transaction) {
    // TODO: Adjust the alignment based on the profile's timestamp if it does
    // not match the transaction's start timestamp
    const transactionDuration = transaction.endTimestamp - transaction.startTimestamp;
    // On most platforms, profile duration < transaction duration, however
    // there is one beloved platform where that is not true; android.
    // Hence, we should take the max of the two to ensure both the transaction
    // and profile are fully visible to the user.
    const duration = Math.max(
      formatTo(transactionDuration, 'seconds', unit),
      maxProfileDuration
    );
    return new Rect(0, 0, duration, 0);
  }

  // No transaction was found, so best we can do is align it to the starting
  // position of the profiles - find the max of profile durations
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
  focusFrame: FlamegraphSearchType['highlightFrames']
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

function computeProfileOffset(
  flamegraph: FlamegraphModel,
  transaction: RequestState<EventTransaction | null>
): number {
  let offset = flamegraph.profile.startedAt;

  const transactionStart =
    transaction.type === 'resolved' ? transaction.data?.startTimestamp ?? null : null;

  const profileStart = flamegraph.profile.timestamp;

  if (defined(transactionStart) && defined(profileStart)) {
    offset += formatTo(
      profileStart - transactionStart,
      'second',
      flamegraph.profile.unit
    );
  }

  return offset;
}

const LOADING_OR_FALLBACK_FLAMEGRAPH = FlamegraphModel.Empty();
const LOADING_OR_FALLBACK_SPAN_TREE = SpanTree.Empty;
const LOADING_OR_FALLBACK_UIFRAMES = UIFrames.Empty;
const LOADING_OR_FALLBACK_BATTERY_CHART = FlamegraphChartModel.Empty;
const LOADING_OR_FALLBACK_CPU_CHART = FlamegraphChartModel.Empty;
const LOADING_OR_FALLBACK_MEMORY_CHART = FlamegraphChartModel.Empty;

const noopFormatDuration = () => '';

function Flamegraph(): ReactElement {
  const devicePixelRatio = useDevicePixelRatio();
  const profiledTransaction = useProfileTransaction();
  const dispatch = useDispatchFlamegraphState();

  const setProfiles = useSetProfiles();
  const profileGroup = useProfileGroup();

  const flamegraphTheme = useFlamegraphTheme();
  const position = useFlamegraphZoomPosition();
  const profiles = useFlamegraphProfiles();
  const {colorCoding, sorting, view} = useFlamegraphPreferences();
  const {highlightFrames} = useFlamegraphSearch();
  const {threadId, selectedRoot} = useFlamegraphProfiles();

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

  const [batteryChartCanvasRef, setBatteryChartCanvasRef] =
    useState<HTMLCanvasElement | null>(null);
  const [cpuChartCanvasRef, setCpuChartCanvasRef] = useState<HTMLCanvasElement | null>(
    null
  );
  const [memoryChartCanvasRef, setMemoryChartCanvasRef] =
    useState<HTMLCanvasElement | null>(null);

  const canvasPoolManager = useMemo(() => new CanvasPoolManager(), []);
  const scheduler = useCanvasScheduler(canvasPoolManager);

  const hasUIFrames = useMemo(() => {
    const platform = profileGroup.metadata.platform;
    return platform === 'cocoa' || platform === 'android';
  }, [profileGroup.metadata.platform]);

  const hasBatteryChart = useMemo(() => {
    const platform = profileGroup.metadata.platform;
    return platform === 'cocoa';
  }, [profileGroup.metadata.platform]);

  const hasCPUChart = useMemo(() => {
    const platform = profileGroup.metadata.platform;
    return platform === 'cocoa' || platform === 'android' || platform === 'node';
  }, [profileGroup.metadata.platform]);

  const hasMemoryChart = useMemo(() => {
    const platform = profileGroup.metadata.platform;
    return platform === 'cocoa' || platform === 'android' || platform === 'node';
  }, [profileGroup.metadata.platform]);

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

    return new SpanChart(spanTree, {
      unit: profile.unit,
      configSpace: getMaxConfigSpace(
        profileGroup,
        profiledTransaction.type === 'resolved' ? profiledTransaction.data : null,
        profile.unit
      ),
    });
  }, [spanTree, profile, profileGroup, profiledTransaction]);

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

    const newFlamegraph = new FlamegraphModel(profile, {
      inverted: view === 'bottom up',
      sort: sorting,
      configSpace: getMaxConfigSpace(
        profileGroup,
        profiledTransaction.type === 'resolved' ? profiledTransaction.data : null,
        profile.unit
      ),
    });
    transaction.finish();

    return newFlamegraph;
  }, [profile, profileGroup, profiledTransaction, sorting, threadId, view]);

  const profileOffsetFromTransaction = useMemo(
    () => computeProfileOffset(flamegraph, profiledTransaction),
    [flamegraph, profiledTransaction]
  );

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

  const batteryChart = useMemo(() => {
    if (!hasCPUChart) {
      return LOADING_OR_FALLBACK_BATTERY_CHART;
    }

    const measures: ProfileSeriesMeasurement[] = [];

    for (const key in profileGroup.measurements) {
      if (key === 'cpu_energy_usage') {
        measures.push({
          ...profileGroup.measurements[key]!,
          values: profileGroup.measurements[key]!.values.map(v => {
            return {
              elapsed_since_start_ns: v.elapsed_since_start_ns,
              value: fromNanoJoulesToWatts(v.value, 0.1),
            };
          }),
          // some versions of cocoa send byte so we need to correct it to watt
          unit: 'watt',
          name: 'CPU energy usage',
        });
      }
    }

    return new FlamegraphChartModel(
      Rect.From(flamegraph.configSpace),
      measures.length > 0 ? measures : [],
      flamegraphTheme.COLORS.BATTERY_CHART_COLORS
    );
  }, [profileGroup.measurements, flamegraph.configSpace, flamegraphTheme, hasCPUChart]);

  const CPUChart = useMemo(() => {
    if (!hasCPUChart) {
      return LOADING_OR_FALLBACK_CPU_CHART;
    }

    const measures: ProfileSeriesMeasurement[] = [];

    for (const key in profileGroup.measurements) {
      if (key.startsWith('cpu_usage')) {
        const name =
          key === 'cpu_usage'
            ? 'Average CPU usage'
            : `CPU Core ${key.replace('cpu_usage_', '')}`;
        measures.push({...profileGroup.measurements[key]!, name});
      }
    }

    return new FlamegraphChartModel(
      Rect.From(flamegraph.configSpace),
      measures.length > 0 ? measures : [],
      flamegraphTheme.COLORS.CPU_CHART_COLORS
    );
  }, [profileGroup.measurements, flamegraph.configSpace, flamegraphTheme, hasCPUChart]);

  const memoryChart = useMemo(() => {
    if (!hasMemoryChart) {
      return LOADING_OR_FALLBACK_MEMORY_CHART;
    }

    const measures: ProfileSeriesMeasurement[] = [];

    const memory_footprint = profileGroup.measurements?.memory_footprint;
    if (memory_footprint) {
      measures.push({
        ...memory_footprint!,
        name: 'Heap Usage',
      });
    }

    const native_memory_footprint = profileGroup.measurements?.memory_native_footprint;
    if (native_memory_footprint) {
      measures.push({
        ...native_memory_footprint!,
        name: 'Native Heap Usage',
      });
    }

    return new FlamegraphChartModel(
      Rect.From(flamegraph.configSpace),
      measures.length > 0 ? measures : [],
      flamegraphTheme.COLORS.MEMORY_CHART_COLORS,
      {type: 'area'}
    );
  }, [
    profileGroup.measurements,
    flamegraph.configSpace,
    flamegraphTheme,
    hasMemoryChart,
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

  const batteryChartCanvas = useMemo(() => {
    if (!batteryChartCanvasRef) {
      return null;
    }
    return new FlamegraphCanvas(batteryChartCanvasRef, vec2.fromValues(0, 0));
  }, [batteryChartCanvasRef]);

  const cpuChartCanvas = useMemo(() => {
    if (!cpuChartCanvasRef) {
      return null;
    }
    return new FlamegraphCanvas(cpuChartCanvasRef, vec2.fromValues(0, 0));
  }, [cpuChartCanvasRef]);

  const memoryChartCanvas = useMemo(() => {
    if (!memoryChartCanvasRef) {
      return null;
    }
    return new FlamegraphCanvas(memoryChartCanvasRef, vec2.fromValues(0, 0));
  }, [memoryChartCanvasRef]);

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
          configSpaceTransform: new Rect(profileOffsetFromTransaction, 0, 0, 0),
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
          ).transformRect(newView.configSpaceTransform);
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
    [flamegraph, flamegraphCanvas, flamegraphTheme, profileOffsetFromTransaction]
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
          configSpaceTransform: new Rect(profileOffsetFromTransaction, 0, 0, 0),
        },
      });

      // Initialize configView to whatever the flamegraph configView is
      newView.setConfigView(
        flamegraphView.configView.withHeight(newView.configView.height),
        {width: {min: 0}}
      );

      return newView;
    },
    [flamegraphView, flamegraphCanvas, flamegraph, uiFrames, profileOffsetFromTransaction]
  );

  const batteryChartView = useMemoWithPrevious<CanvasView<FlamegraphChartModel> | null>(
    _previousView => {
      if (!flamegraphView || !flamegraphCanvas || !batteryChart || !batteryChartCanvas) {
        return null;
      }

      const newView = new CanvasView({
        canvas: flamegraphCanvas,
        model: batteryChart,
        mode: 'anchorBottom',
        options: {
          // Invert chart so origin is at bottom left
          // corner as opposed to top left
          inverted: true,
          minWidth: uiFrames.minFrameDuration,
          barHeight: 0,
          depthOffset: 0,
          maxHeight: batteryChart.configSpace.height,
          minHeight: batteryChart.configSpace.height,
          configSpaceTransform: new Rect(profileOffsetFromTransaction, 0, 0, 0),
        },
      });

      // Compute the total size of the padding and stretch the view. This ensures that
      // the total range is rendered and perfectly aligned from top to bottom.
      newView.setConfigView(
        flamegraphView.configView.withHeight(newView.configView.height),
        {
          width: {min: 1},
        }
      );

      return newView;
    },
    [
      flamegraphView,
      flamegraphCanvas,
      batteryChart,
      uiFrames.minFrameDuration,
      batteryChartCanvas,
      profileOffsetFromTransaction,
    ]
  );

  const cpuChartView = useMemoWithPrevious<CanvasView<FlamegraphChartModel> | null>(
    _previousView => {
      if (!flamegraphView || !flamegraphCanvas || !CPUChart || !cpuChartCanvas) {
        return null;
      }

      const newView = new CanvasView({
        canvas: flamegraphCanvas,
        model: CPUChart,
        mode: 'anchorBottom',
        options: {
          // Invert chart so origin is at bottom left
          // corner as opposed to top left
          inverted: true,
          minWidth: uiFrames.minFrameDuration,
          barHeight: 0,
          depthOffset: 0,
          maxHeight: CPUChart.configSpace.height,
          minHeight: CPUChart.configSpace.height,
          configSpaceTransform: new Rect(profileOffsetFromTransaction, 0, 0, 0),
        },
      });

      // Compute the total size of the padding and stretch the view. This ensures that
      // the total range is rendered and perfectly aligned from top to bottom.
      newView.setConfigView(
        flamegraphView.configView.withHeight(newView.configView.height),
        {
          width: {min: 1},
        }
      );

      return newView;
    },
    [
      flamegraphView,
      flamegraphCanvas,
      CPUChart,
      uiFrames.minFrameDuration,
      cpuChartCanvas,
      profileOffsetFromTransaction,
    ]
  );

  const memoryChartView = useMemoWithPrevious<CanvasView<FlamegraphChartModel> | null>(
    _previousView => {
      if (!flamegraphView || !flamegraphCanvas || !memoryChart || !memoryChartCanvas) {
        return null;
      }

      const newView = new CanvasView({
        canvas: flamegraphCanvas,
        model: memoryChart,
        mode: 'anchorBottom',
        options: {
          // Invert chart so origin is at bottom left
          // corner as opposed to top left
          inverted: true,
          minWidth: uiFrames.minFrameDuration,
          barHeight: 0,
          depthOffset: 0,
          maxHeight: memoryChart.configSpace.height,
          minHeight: memoryChart.configSpace.height,
          configSpaceTransform: new Rect(profileOffsetFromTransaction, 0, 0, 0),
        },
      });

      // Compute the total size of the padding and stretch the view. This ensures that
      // the total range is rendered and perfectly aligned from top to bottom.
      newView.setConfigView(
        flamegraphView.configView.withHeight(newView.configView.height),
        {
          width: {min: 1},
        }
      );

      return newView;
    },
    [
      flamegraphView,
      flamegraphCanvas,
      memoryChart,
      uiFrames.minFrameDuration,
      memoryChartCanvas,
      profileOffsetFromTransaction,
    ]
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
        },
      });

      // Initialize configView to whatever the flamegraph configView is
      newView.setConfigView(
        flamegraphView.configView.withHeight(newView.configView.height),
        {width: {min: 1}}
      );

      return newView;
    },
    [spanChart, spansCanvas, flamegraphView, flamegraphTheme.SIZES]
  );

  // We want to make sure that the views have the same min zoom levels so that
  // if you wheel zoom on one, the other one will also zoom to the same level of detail.
  // If we dont do this, then at some point during the zoom action the views will
  // detach and only one will zoom while the other one will stay at the same zoom level.
  useEffect(() => {
    const minWidthBetweenViews = Math.min(
      flamegraphView?.minWidth ?? Number.MAX_SAFE_INTEGER,
      spansView?.minWidth ?? Number.MAX_SAFE_INTEGER,
      uiFramesView?.minWidth ?? Number.MAX_SAFE_INTEGER,
      cpuChartView?.minWidth ?? Number.MAX_SAFE_INTEGER,
      memoryChartView?.minWidth ?? Number.MAX_SAFE_INTEGER,
      batteryChartView?.minWidth ?? Number.MAX_SAFE_INTEGER
    );

    flamegraphView?.setMinWidth?.(minWidthBetweenViews);
    spansView?.setMinWidth?.(minWidthBetweenViews);
    uiFramesView?.setMinWidth?.(minWidthBetweenViews);
    cpuChartView?.setMinWidth?.(minWidthBetweenViews);
    memoryChartView?.setMinWidth?.(minWidthBetweenViews);
    batteryChartView?.setMinWidth?.(minWidthBetweenViews);
  }, [
    flamegraphView,
    spansView,
    uiFramesView,
    cpuChartView,
    memoryChartView,
    batteryChartView,
  ]);

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
        if (cpuChartView) {
          cpuChartView.setConfigView(rect);
        }
        if (memoryChartView) {
          memoryChartView.setConfigView(rect);
        }
        if (batteryChartView) {
          batteryChartView.setConfigView(rect);
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
        if (cpuChartView) {
          cpuChartView.setConfigView(rect);
        }
        if (memoryChartView) {
          memoryChartView.setConfigView(rect);
        }
        if (batteryChartView) {
          batteryChartView.setConfigView(rect);
        }
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
        if (uiFramesView) {
          uiFramesView.transformConfigView(mat);
        }
        if (batteryChartView) {
          batteryChartView.transformConfigView(mat);
        }
        if (cpuChartView) {
          cpuChartView.transformConfigView(mat);
        }
        if (memoryChartView) {
          memoryChartView.transformConfigView(mat);
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
        if (batteryChartView) {
          batteryChartView.transformConfigView(mat);
        }
        if (cpuChartView) {
          cpuChartView.transformConfigView(mat);
        }
        if (memoryChartView) {
          memoryChartView.transformConfigView(mat);
        }
      }

      if (
        sourceTransformConfigView === uiFramesView ||
        sourceTransformConfigView === cpuChartView ||
        sourceTransformConfigView === memoryChartView ||
        sourceTransformConfigView === batteryChartView
      ) {
        if (flamegraphView) {
          const beforeY = flamegraphView.configView.y;
          flamegraphView.transformConfigView(mat);
          flamegraphView.setConfigView(flamegraphView.configView.withY(beforeY));
        }

        if (spansView) {
          const beforeY = spansView.configView.y;
          spansView.transformConfigView(mat);
          spansView.setConfigView(spansView.configView.withY(beforeY));
        }
        if (uiFramesView) {
          uiFramesView.transformConfigView(mat);
        }
        if (batteryChartView) {
          batteryChartView.transformConfigView(mat);
        }
        if (cpuChartView) {
          cpuChartView.transformConfigView(mat);
        }
        if (memoryChartView) {
          memoryChartView.transformConfigView(mat);
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
      if (batteryChartView && batteryChartCanvas) {
        batteryChartView.resetConfigView(batteryChartCanvas);
      }
      if (cpuChartView && cpuChartCanvas) {
        cpuChartView.resetConfigView(cpuChartCanvas);
      }
      if (memoryChartView && memoryChartCanvas) {
        memoryChartView.resetConfigView(memoryChartCanvas);
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
      if (batteryChartView) {
        batteryChartView.setConfigView(
          newConfigView.withHeight(batteryChartView.configView.height)
        );
      }
      if (cpuChartView) {
        cpuChartView.setConfigView(
          newConfigView.withHeight(cpuChartView.configView.height)
        );
      }
      if (memoryChartView) {
        memoryChartView.setConfigView(
          newConfigView.withHeight(memoryChartView.configView.height)
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
        spansView.configView,
        new Rect(span.start, span.depth, span.end - span.start, 1)
      ).transformRect(spansView.configSpaceTransform);

      spansView.setConfigView(newConfigView);
      flamegraphView.setConfigView(
        newConfigView
          .withHeight(flamegraphView.configView.height)
          .withY(flamegraphView.configView.y)
      );
      if (uiFramesView) {
        uiFramesView.setConfigView(
          newConfigView.withHeight(uiFramesView.configView.height)
        );
      }
      if (batteryChartView) {
        batteryChartView.setConfigView(
          newConfigView.withHeight(batteryChartView.configView.height)
        );
      }
      if (cpuChartView) {
        cpuChartView.setConfigView(
          newConfigView.withHeight(cpuChartView.configView.height)
        );
      }
      if (memoryChartView) {
        memoryChartView.setConfigView(
          newConfigView.withHeight(memoryChartView.configView.height)
        );
      }
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
    cpuChartCanvas,
    cpuChartView,
    memoryChartCanvas,
    memoryChartView,
    batteryChartView,
    batteryChartCanvas,
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

  const batteryChartCanvases = useMemo(() => {
    return [batteryChartCanvasRef];
  }, [batteryChartCanvasRef]);

  const batteryChartCanvasBounds = useResizeCanvasObserver(
    batteryChartCanvases,
    canvasPoolManager,
    batteryChartCanvas,
    batteryChartView
  );

  const cpuChartCanvases = useMemo(() => {
    return [cpuChartCanvasRef];
  }, [cpuChartCanvasRef]);

  const cpuChartCanvasBounds = useResizeCanvasObserver(
    cpuChartCanvases,
    canvasPoolManager,
    cpuChartCanvas,
    cpuChartView
  );

  const memoryChartCanvases = useMemo(() => {
    return [memoryChartCanvasRef];
  }, [memoryChartCanvasRef]);
  const memoryChartCanvasBounds = useResizeCanvasObserver(
    memoryChartCanvases,
    canvasPoolManager,
    memoryChartCanvas,
    memoryChartView
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

    const renderer = initializeFlamegraphRenderer(
      [FlamegraphRendererWebGL, FlamegraphRenderer2D],
      [
        flamegraphCanvasRef,
        flamegraph,
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

          const graph = new FlamegraphModel(currentProfile, {
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
        batteryChart={
          hasBatteryChart ? (
            <FlamegraphChart
              chartCanvasRef={batteryChartCanvasRef}
              chartCanvas={batteryChartCanvas}
              setChartCanvasRef={setBatteryChartCanvasRef}
              canvasBounds={batteryChartCanvasBounds}
              chartView={batteryChartView}
              canvasPoolManager={canvasPoolManager}
              chart={batteryChart}
              noMeasurementMessage={
                profileGroup.metadata.platform === 'cocoa'
                  ? t(
                      'Upgrade to version 8.9.6 of sentry-cocoa SDK to enable battery usage collection'
                    )
                  : ''
              }
            />
          ) : null
        }
        memoryChart={
          hasMemoryChart ? (
            <FlamegraphChart
              chartCanvasRef={memoryChartCanvasRef}
              chartCanvas={memoryChartCanvas}
              setChartCanvasRef={setMemoryChartCanvasRef}
              canvasBounds={memoryChartCanvasBounds}
              chartView={memoryChartView}
              canvasPoolManager={canvasPoolManager}
              chart={memoryChart}
              noMeasurementMessage={
                profileGroup.metadata.platform === 'cocoa'
                  ? t(
                      'Upgrade to version 8.9.6 of sentry-cocoa SDK to enable memory usage collection'
                    )
                  : profileGroup.metadata.platform === 'node'
                    ? t(
                        'Upgrade to version 1.2.0 of @sentry/profiling-node to enable memory usage collection'
                      )
                    : ''
              }
            />
          ) : null
        }
        cpuChart={
          hasCPUChart ? (
            <FlamegraphChart
              chartCanvasRef={cpuChartCanvasRef}
              chartCanvas={cpuChartCanvas}
              setChartCanvasRef={setCpuChartCanvasRef}
              canvasBounds={cpuChartCanvasBounds}
              chartView={cpuChartView}
              canvasPoolManager={canvasPoolManager}
              chart={CPUChart}
              noMeasurementMessage={
                profileGroup.metadata.platform === 'cocoa'
                  ? t(
                      'Upgrade to version 8.9.6 of sentry-cocoa SDK to enable CPU usage collection'
                    )
                  : profileGroup.metadata.platform === 'node'
                    ? t(
                        'Upgrade to version 1.2.0 of @sentry/profiling-node to enable CPU usage collection'
                      )
                    : ''
              }
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
              profileGroup={profileGroup}
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
