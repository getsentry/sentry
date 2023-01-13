import {cloneElement, useCallback, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {type FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import {type FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useDispatchFlamegraphState} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphState';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {
  type UseResizableDrawerOptions,
  useResizableDrawer,
} from 'sentry/utils/profiling/hooks/useResizableDrawer';

import {CollapsibleTimeline} from './collapsibleTimeline';

// 664px is approximately the width where we start to scroll inside
// 30px is the min height to where the drawer can still be resized
const MIN_FLAMEGRAPH_DRAWER_DIMENSIONS: [number, number] = [680, 30];
interface FlamegraphLayoutProps {
  flamegraph: React.ReactElement;
  flamegraphDrawer: React.ReactElement;
  minimap: React.ReactElement;
  spans: React.ReactElement | null;
}

export function FlamegraphLayout(props: FlamegraphLayoutProps) {
  const flamegraphTheme = useFlamegraphTheme();
  const {layout, timelines} = useFlamegraphPreferences();
  const dispatch = useDispatchFlamegraphState();
  const flamegraphDrawerRef = useRef<HTMLDivElement>(null);

  const resizableOptions: UseResizableDrawerOptions = useMemo(() => {
    const initialDimensions: [number, number] = [
      // Half the screen minus the ~sidebar width
      Math.max(window.innerWidth * 0.5 - 220, MIN_FLAMEGRAPH_DRAWER_DIMENSIONS[0]),
      180,
    ];

    const onResize = (
      newDimensions: [number, number],
      maybeOldDimensions: [number, number] | undefined
    ) => {
      if (!flamegraphDrawerRef.current) {
        return;
      }

      if (layout === 'table left' || layout === 'table right') {
        flamegraphDrawerRef.current.style.width = `${
          maybeOldDimensions?.[0] ?? newDimensions[0]
        }px`;
        flamegraphDrawerRef.current.style.height = `100%`;
      } else {
        flamegraphDrawerRef.current.style.height = `${
          maybeOldDimensions?.[1] ?? newDimensions[1]
        }px`;
        flamegraphDrawerRef.current.style.width = `100%`;
      }
    };

    return {
      initialDimensions,
      onResize,
      direction:
        layout === 'table left'
          ? 'horizontal-ltr'
          : layout === 'table right'
          ? 'horizontal-rtl'
          : 'vertical',
      min: MIN_FLAMEGRAPH_DRAWER_DIMENSIONS,
    };
  }, [layout]);

  const {onMouseDown} = useResizableDrawer(resizableOptions);

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

  return (
    <FlamegraphLayoutContainer>
      <FlamegraphGrid layout={layout}>
        <MinimapContainer
          height={timelines.minimap ? flamegraphTheme.SIZES.MINIMAP_HEIGHT : 20}
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
        {props.spans ? (
          <SpansContainer
            height={timelines.transaction_spans ? flamegraphTheme.SIZES.SPANS_HEIGHT : 20}
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
        <ZoomViewContainer>{props.flamegraph}</ZoomViewContainer>
        <FlamegraphDrawerContainer ref={flamegraphDrawerRef} layout={layout}>
          {cloneElement(props.flamegraphDrawer, {onResize: onMouseDown})}
        </FlamegraphDrawerContainer>
      </FlamegraphGrid>
    </FlamegraphLayoutContainer>
  );
}

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
      ? 'auto auto 1fr'
      : layout === 'table right'
      ? 'min-content min-content 1fr'
      : 'min-content min-content 1fr'};
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
        'spans'
        'flamegraph'
        'frame-stack'
        `
      : layout === 'table right'
      ? `
        'minimap    frame-stack'
        'spans     frame-stack'
        'flamegraph frame-stack'
      `
      : layout === 'table left'
      ? `
        'frame-stack minimap'
        'frame-stack spans'
        'frame-stack flamegraph'
    `
      : ''};
`;

const MinimapContainer = styled('div')<{
  height: FlamegraphTheme['SIZES']['MINIMAP_HEIGHT'];
}>`
  position: relative;
  height: ${p => p.height}px;
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
  height: FlamegraphTheme['SIZES']['SPANS_HEIGHT'];
}>`
  position: relative;
  height: ${p => p.height}px;
  grid-area: spans;
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
