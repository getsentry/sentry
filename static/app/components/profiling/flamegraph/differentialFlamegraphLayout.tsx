import {cloneElement, useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
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

interface DifferentialFlamegraphLayoutProps {
  flamegraph: React.ReactElement;
  flamegraphDrawer: React.ReactElement;
  minimap: React.ReactElement;
}

export function DifferentialFlamegraphLayout(props: DifferentialFlamegraphLayoutProps) {
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

  return (
    <DifferentialFlamegraphLayoutContainer>
      <DifferentialFlamegraphGrid layout={layout}>
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
        <ZoomViewContainer>
          <ProfileLabel>{t('Differential Flamegraph')}</ProfileLabel>
          <ZoomViewInnerContainer>{props.flamegraph}</ZoomViewInnerContainer>
        </ZoomViewContainer>
        <DifferentialFlamegraphDrawerContainer ref={flamegraphDrawerRef} layout={layout}>
          {cloneElement(props.flamegraphDrawer, {
            onResize: onMouseDown,
            onResizeReset: onDoubleClick,
          })}
        </DifferentialFlamegraphDrawerContainer>
      </DifferentialFlamegraphGrid>
    </DifferentialFlamegraphLayoutContainer>
  );
}

const ProfileLabel = styled(CollapsibleTimelineLabel)`
  width: 100%;
  position: relative;
  top: 0;
  left: 0;
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary} 0%,
    ${p => p.theme.backgroundSecondary} 80%,
    transparent 100%
  );
  border-top: 1px solid ${p => p.theme.border};
  border-bottom: 1px solid ${p => p.theme.border};
  padding-right: ${space(2)};
  z-index: 1;
  /* Visually align with the grid */
  transform: translateY(1px);
`;

const DifferentialFlamegraphLayoutContainer = styled('div')`
  display: flex;
  flex: 1 1 100%;
`;

const DifferentialFlamegraphGrid = styled('div')<{
  layout?: FlamegraphPreferences['layout'];
}>`
  background-color: ${p => p.theme.background};
  display: grid;
  width: 100%;
  grid-template-rows: ${({layout}) =>
    layout === 'table bottom'
      ? 'auto 1fr auto'
      : layout === 'table right'
      ? 'min-content 1fr'
      : 'min-content 1fr'};
  grid-template-columns: ${({layout}) =>
    layout === 'table bottom'
      ? '100%'
      : layout === 'table left'
      ? `min-content min-content auto`
      : `auto min-content min-content`};

  /* false positive for grid layout */
  /* stylelint-disable */
  grid-template-areas: ${({layout}) =>
    layout === 'table bottom'
      ? `
        'minimap'
        'flamegraph'
        'frame-stack'
        `
      : layout === 'table right'
      ? `
        'minimap        frame-stack'
        'flamegraph     frame-stack'
      `
      : layout === 'table left'
      ? `
        'frame-stack minimap'
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
const ZoomViewInnerContainer = styled('div')`
  flex: 1;
`;

const DifferentialFlamegraphDrawerContainer = styled('div')<{
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
