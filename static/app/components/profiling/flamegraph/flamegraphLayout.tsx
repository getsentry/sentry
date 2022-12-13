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
import {useStoredDimensions} from 'sentry/utils/profiling/hooks/useStoredDimensions';

// 680px is approximately the width where we start to scroll inside
// 30px is the min height to where the drawer can still be resized
const MIN_FLAMEGRAPH_DRAWER_DIMENSIONS: [number, number] = [680, 30];

interface FlamegraphLayoutProps {
  flamegraph: React.ReactElement;
  flamegraphDrawer: React.ReactElement;
  minimap: React.ReactElement;
}

function getDefaultDrawerDimensions(
  layout: FlamegraphPreferences['layout']
): [number, number] {
  if (layout === 'table bottom') {
    return [0.7, 0.3];
  }
  return [0.5, 0.5];
}

export function FlamegraphLayout(props: FlamegraphLayoutProps) {
  const flamegraphTheme = useFlamegraphTheme();
  const {layout} = useFlamegraphPreferences();
  const flamegraphDrawerRef = useRef<HTMLDivElement>(null);
  const flamegraphPreferences = useFlamegraphPreferences();

  const [storedDimensions, setStoredDimensions] = useStoredDimensions(
    'profiling:drawer-dimensions',
    {
      [layout]: getDefaultDrawerDimensions(layout),
    },
    {debounce: 200}
  );

  const resizableOptions: UseResizableDrawerOptions = useMemo(() => {
    const initialDimensions: [number, number] = storedDimensions?.[
      flamegraphPreferences.layout
    ]
      ? [
          storedDimensions[flamegraphPreferences.layout]?.[0] as number,
          storedDimensions[flamegraphPreferences.layout]?.[1] as number,
        ]
      : getDefaultDrawerDimensions(layout);

    const onResize = (
      newDimensions: [number, number] | undefined,
      oldDimensions: [number, number] | undefined
    ) => {
      if (!flamegraphDrawerRef.current) {
        return;
      }

      if (!newDimensions && !oldDimensions) {
        return;
      }

      const dimensionsToStore = newDimensions || oldDimensions;

      if (!dimensionsToStore) {
        return;
      }
      const widthInPx = dimensionsToStore[0] * window.innerWidth;
      const heightInPx = dimensionsToStore[1] * window.innerHeight;

      if (layout === 'table left' || layout === 'table right') {
        flamegraphDrawerRef.current.style.width = `${widthInPx}px`;
        flamegraphDrawerRef.current.style.height = `100%`; // clear any previously set height
      } else {
        flamegraphDrawerRef.current.style.height = `${heightInPx}px`;
        flamegraphDrawerRef.current.style.width = `100%`; // clear any previously set width
      }

      setStoredDimensions(layout, dimensionsToStore);
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
    // we dont care about the initialDimensions past the first render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    flamegraphTheme.SIZES.FLAMEGRAPH_DEPTH_OFFSET,
    flamegraphTheme.SIZES.BAR_HEIGHT,
    flamegraphPreferences.layout,
    layout,
  ]);

  const {onMouseDown} = useResizableDrawer(resizableOptions);

  return (
    <FlamegraphLayoutContainer>
      <FlamegraphGrid layout={layout}>
        <MinimapContainer height={flamegraphTheme.SIZES.MINIMAP_HEIGHT}>
          {props.minimap}
        </MinimapContainer>
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

const FlamegraphDrawerContainer = styled('div')<{
  layout: FlamegraphPreferences['layout'];
}>`
  grid-area: frame-stack;
  position: relative;
  overflow: hidden;
  min-width: ${MIN_FLAMEGRAPH_DRAWER_DIMENSIONS[0]}px;
  min-height: ${MIN_FLAMEGRAPH_DRAWER_DIMENSIONS[1]}px;

  > div {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
  }
`;
