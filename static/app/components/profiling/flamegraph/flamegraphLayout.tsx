import {cloneElement, useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {
  useResizableDrawer,
  UseResizableDrawerOptions,
} from 'sentry/utils/useResizableDrawer';

import {CollapsibleTimeline, CollapsibleTimelineLabel} from './collapsibleTimeline';

// 664px is approximately the width where we start to scroll inside
// 30px is the min height to where the drawer can still be resized
const MIN_FLAMEGRAPH_DRAWER_DIMENSIONS: [number, number] = [680, 30];
const FLAMEGRAPH_DRAWER_INITIAL_HEIGHT = 166;
const TIMELINE_LABEL_HEIGHT = 20;
const EMPTY_TIMELINE_HEIGHT = 80;

interface FlamegraphLayoutProps {
  flamegraph: React.ReactElement;
  flamegraphDrawer: React.ReactElement;
  minimap: React.ReactElement;
  spans: React.ReactElement | null;
  uiFrames: React.ReactElement | null;
  spansTreeDepth?: number;
}

export function FlamegraphLayout(props: FlamegraphLayoutProps) {
  const flamegraphTheme = useFlamegraphTheme();
  const {layout, timelines} = useFlamegraphPreferences();
  const dispatch = useDispatchFlamegraphState();
  const flamegraphDrawerRef = useRef<HTMLDivElement>(null);

  const resizableOptions: UseResizableDrawerOptions = useMemo(() => {
    const isSidebarLayout = layout === 'table left' || layout === 'table right';

    const initialSize = isSidebarLayout
      ? // Half the screen minus the ~sidebar width
        Math.max(window.innerWidth * 0.5 - 220, MIN_FLAMEGRAPH_DRAWER_DIMENSIONS[0])
      : FLAMEGRAPH_DRAWER_INITIAL_HEIGHT;

    const min = isSidebarLayout
      ? MIN_FLAMEGRAPH_DRAWER_DIMENSIONS[0]
      : MIN_FLAMEGRAPH_DRAWER_DIMENSIONS[1];

    const onResize = (newSize: number, maybeOldSize: number | undefined) => {
      if (!flamegraphDrawerRef.current) {
        return;
      }

      if (isSidebarLayout) {
        flamegraphDrawerRef.current.style.width = `${maybeOldSize ?? newSize}px`;
        flamegraphDrawerRef.current.style.height = `100%`;
      } else {
        flamegraphDrawerRef.current.style.height = `${maybeOldSize ?? newSize}px`;
        flamegraphDrawerRef.current.style.width = `100%`;
      }
    };

    return {
      initialSize,
      onResize,
      direction:
        layout === 'table left' ? 'left' : layout === 'table right' ? 'right' : 'up',
      min,
    };
  }, [layout]);

  const {onMouseDown, onDoubleClick} = useResizableDrawer(resizableOptions);

  const onOpenMinimap = useCallback(
    () =>
      dispatch({type: 'toggle timeline', payload: {timeline: 'minimap', value: true}}),
    [dispatch]
  );

  const onCloseMinimap = useCallback(
    () =>
      dispatch({type: 'toggle timeline', payload: {timeline: 'minimap', value: false}}),
    [dispatch]
  );

  const onOpenSpans = useCallback(
    () =>
      dispatch({
        type: 'toggle timeline',
        payload: {timeline: 'transaction_spans', value: true},
      }),
    [dispatch]
  );

  const onCloseSpans = useCallback(
    () =>
      dispatch({
        type: 'toggle timeline',
        payload: {timeline: 'transaction_spans', value: false},
      }),
    [dispatch]
  );

  const onOpenUIFrames = useCallback(
    () =>
      dispatch({
        type: 'toggle timeline',
        payload: {timeline: 'ui_frames', value: true},
      }),
    [dispatch]
  );

  const onCloseUIFrames = useCallback(
    () =>
      dispatch({
        type: 'toggle timeline',
        payload: {timeline: 'ui_frames', value: false},
      }),
    [dispatch]
  );

  const spansTreeDepth = props.spansTreeDepth ?? 0;
  const spansTimelineHeight =
    Math.min(
      (spansTreeDepth + flamegraphTheme.SIZES.SPANS_DEPTH_OFFSET) *
        flamegraphTheme.SIZES.SPANS_BAR_HEIGHT,
      flamegraphTheme.SIZES.MAX_SPANS_HEIGHT
    ) + TIMELINE_LABEL_HEIGHT;

  return (
    <FlamegraphLayoutContainer>
      <FlamegraphGrid layout={layout}>
        <MinimapContainer
          containerHeight={
            timelines.minimap
              ? flamegraphTheme.SIZES.MINIMAP_HEIGHT
              : TIMELINE_LABEL_HEIGHT
          }
        >
          <CollapsibleTimeline
            title="Minimap"
            open={timelines.minimap}
            onOpen={onOpenMinimap}
            onClose={onCloseMinimap}
          >
            {props.minimap}
          </CollapsibleTimeline>
        </MinimapContainer>
        {props.uiFrames ? (
          <UIFramesContainer
            containerHeight={
              timelines.ui_frames
                ? flamegraphTheme.SIZES.UI_FRAMES_HEIGHT
                : TIMELINE_LABEL_HEIGHT
            }
          >
            <CollapsibleTimeline
              title={t('UI Frames')}
              open={timelines.ui_frames}
              onOpen={onOpenUIFrames}
              onClose={onCloseUIFrames}
            >
              {props.uiFrames}
            </CollapsibleTimeline>
          </UIFramesContainer>
        ) : null}
        {props.spans ? (
          <SpansContainer
            containerHeight={
              // If we have a span depth
              timelines.transaction_spans
                ? props.spansTreeDepth
                  ? spansTimelineHeight
                  : EMPTY_TIMELINE_HEIGHT
                : TIMELINE_LABEL_HEIGHT
            }
          >
            <CollapsibleTimeline
              title={t('Transaction')}
              open={timelines.transaction_spans}
              onOpen={onOpenSpans}
              onClose={onCloseSpans}
            >
              {props.spans}
            </CollapsibleTimeline>
          </SpansContainer>
        ) : null}
        <ZoomViewContainer>
          <ProfileLabel>{t('Profile')}</ProfileLabel>
          {props.flamegraph}
        </ZoomViewContainer>
        <FlamegraphDrawerContainer ref={flamegraphDrawerRef} layout={layout}>
          {cloneElement(props.flamegraphDrawer, {
            onResize: onMouseDown,
            onResizeReset: onDoubleClick,
          })}
        </FlamegraphDrawerContainer>
      </FlamegraphGrid>
    </FlamegraphLayoutContainer>
  );
}

const ProfileLabel = styled(CollapsibleTimelineLabel)`
  position: absolute;
  top: 0;
  left: 0;
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary} 0%,
    ${p => p.theme.backgroundSecondary} 80%,
    transparent 100%
  );
  padding-right: ${space(2)};
  z-index: 1;
  /* Visually align with the grid */
  transform: translateY(1px);
`;

const FlamegraphLayoutContainer = styled('div')`
  display: flex;
  flex: 1 1 100%;
`;

const FlamegraphGrid = styled('div')<{
  layout?: FlamegraphPreferences['layout'];
}>`
  display: grid;
  width: 100%;
  grid-template-rows: ${({layout}) =>
    layout === 'table bottom'
      ? 'auto auto auto 1fr'
      : layout === 'table right'
      ? 'min-content min-content min-content 1fr'
      : 'min-content min-content min-content 1fr'};
  grid-template-columns: ${({layout}) =>
    layout === 'table bottom'
      ? '100%'
      : layout === 'table left'
      ? `min-content auto`
      : `auto min-content`};

  /* false positive for grid layout */
  /* stylelint-disable */
  grid-template-areas: ${({layout}) =>
    layout === 'table bottom'
      ? `
        'minimap'
        'ui-frames'
        'spans'
        'flamegraph'
        'frame-stack'
        `
      : layout === 'table right'
      ? `
        'minimap    frame-stack'
        'ui-frames  frame-stack'
        'spans     frame-stack'
        'flamegraph frame-stack'
      `
      : layout === 'table left'
      ? `
        'frame-stack minimap'
        'frame-stack ui-frames'
        'frame-stack spans'
        'frame-stack flamegraph'
    `
      : ''};
`;

const MinimapContainer = styled('div')<{
  containerHeight: FlamegraphTheme['SIZES']['MINIMAP_HEIGHT'];
}>`
  position: relative;
  height: ${p => p.containerHeight}px;
  grid-area: minimap;
  display: flex;
  flex-direction: column;
`;

const ZoomViewContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;
  grid-area: flamegraph;
  position: relative;
`;

const SpansContainer = styled('div')<{
  containerHeight: FlamegraphTheme['SIZES']['MAX_SPANS_HEIGHT'];
}>`
  position: relative;
  height: ${p => p.containerHeight}px;
  grid-area: spans;
`;

const UIFramesContainer = styled('div')<{
  containerHeight: FlamegraphTheme['SIZES']['UI_FRAMES_HEIGHT'];
}>`
  position: relative;
  height: ${p => p.containerHeight}px;
  grid-area: ui-frames;
`;

const FlamegraphDrawerContainer = styled('div')<{
  layout: FlamegraphPreferences['layout'];
}>`
  grid-area: frame-stack;
  position: relative;
  overflow: hidden;
  min-width: ${MIN_FLAMEGRAPH_DRAWER_DIMENSIONS[0]}px;

  > div {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
  }
`;
