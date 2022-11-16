import {cloneElement, useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/reducers/flamegraphPreferences';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {useFlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/hooks/useFlamegraphPreferences';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';
import {
  useResizableDrawer,
  UseResizableDrawerOptions,
} from 'sentry/utils/profiling/hooks/useResizableDrawer';

// 664px is approximately the width where we start to scroll inside
// 30px is the min height to where the drawer can still be resized
const MIN_FLAMEGRAPH_DRAWER_DIMENSIONS: [number, number] = [680, 30];
interface FlamegraphLayoutProps {
  flamechart: React.ReactElement;
  flamechartDrawer: React.ReactElement;
  minimap: React.ReactElement;
}

export function FlamegraphLayout(props: FlamegraphLayoutProps) {
  const flamegraphTheme = useFlamegraphTheme();
  const {layout} = useFlamegraphPreferences();
  const flamegraphDrawerRef = useRef<HTMLDivElement>(null);

  const resizableOptions: UseResizableDrawerOptions = useMemo(() => {
    const initialDimensions: [number, number] = [
      // Half the screen minus the ~sidebar width
      Math.max(window.innerWidth * 0.5 - 220, MIN_FLAMEGRAPH_DRAWER_DIMENSIONS[0]),
      (flamegraphTheme.SIZES.FLAMEGRAPH_DEPTH_OFFSET + 2) *
        flamegraphTheme.SIZES.BAR_HEIGHT,
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
  }, [
    flamegraphTheme.SIZES.FLAMEGRAPH_DEPTH_OFFSET,
    flamegraphTheme.SIZES.BAR_HEIGHT,
    layout,
  ]);

  const {onMouseDown} = useResizableDrawer(resizableOptions);

  return (
    <FlamegraphLayoutContainer>
      <FlamegraphGrid layout={layout}>
        <MinimapContainer height={flamegraphTheme.SIZES.MINIMAP_HEIGHT}>
          {props.minimap}
        </MinimapContainer>
        <ZoomViewContainer>{props.flamechart}</ZoomViewContainer>
        <FLAMEGRAPH_DRAWERContainer ref={flamegraphDrawerRef} layout={layout}>
          {cloneElement(props.flamechartDrawer, {onResize: onMouseDown})}
        </FLAMEGRAPH_DRAWERContainer>
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
      ? 'auto 1fr'
      : layout === 'table right'
      ? '100px auto'
      : '100px auto'};
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
        'flamegraph'
        'frame-stack'
        `
      : layout === 'table right'
      ? `
        'minimap    frame-stack'
        'flamegraph frame-stack'
      `
      : layout === 'table left'
      ? `
        'frame-stack minimap'
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
`;

const ZoomViewContainer = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1 1 100%;
  grid-area: flamegraph;
  position: relative;
`;

const FLAMEGRAPH_DRAWERContainer = styled('div')<{
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
