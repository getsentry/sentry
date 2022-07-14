import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphPreferences';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {useFlamegraphPreferencesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';

interface ProfilingFlamechartLayoutProps {
  flamechart: React.ReactNode;
  frameStack: React.ReactNode;
  minimap: React.ReactNode;
}

export function ProfilingFlamechartLayout(props: ProfilingFlamechartLayoutProps) {
  const flamegraphTheme = useFlamegraphTheme();
  const {layout} = useFlamegraphPreferencesValue();

  return (
    <Fragment>
      <ProfilingFlamechartLayoutContainer>
        <ProfilingFlamechartGrid layout={layout}>
          <MinimapContainer height={flamegraphTheme.SIZES.MINIMAP_HEIGHT}>
            {props.minimap}
          </MinimapContainer>
          <ZoomViewContainer>{props.flamechart}</ZoomViewContainer>
          <FrameStackContainer layout={layout}>{props.frameStack}</FrameStackContainer>
        </ProfilingFlamechartGrid>
      </ProfilingFlamechartLayoutContainer>
    </Fragment>
  );
}

const ProfilingFlamechartLayoutContainer = styled('div')`
  display: flex;
  flex: 1 1 100%;
`;

const ProfilingFlamechartGrid = styled('div')<{
  layout?: FlamegraphPreferences['layout'];
}>`
  display: grid;
  width: 100%;
  grid-template-rows: ${({layout}) =>
    layout === 'table_bottom'
      ? 'auto 1fr'
      : layout === 'table_right'
      ? '100px auto'
      : '100px auto'};
  grid-template-columns: ${({layout}) =>
    layout === 'table_bottom' ? '100%' : '50% 50%'};

  /* false positive for grid layout */
  /* stylelint-disable */
  grid-template-areas: ${({layout}) =>
    layout === 'table_bottom'
      ? `
        "minimap"
        "flamegraph"
        "frame-stack"
        `
      : layout === 'table_right'
      ? `
        "minimap    frame-stack"
        "flamegraph frame-stack"
      `
      : layout === 'table_left'
      ? `
        "frame-stack minimap"
        "frame-stack flamegraph"
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
`;

const FrameStackContainer = styled('div')<{layout: FlamegraphPreferences['layout']}>`
  grid-area: frame-stack;
  position: relative;

  ${({layout}) => {
    if (layout === 'table_left' || layout === 'table_right') {
      // If the table is left/right, the height is no longer managed
      // and this grid area will fill the screen. We absolutely position
      // the child so that it cannot overgrow the container.
      return css`
        > div {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          height: 100%;
        }
      `;
    }

    return ``;
  }}
`;
