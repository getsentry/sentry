import {Fragment} from 'react';
import styled from '@emotion/styled';

import {FlamegraphPreferences} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphPreferences';
import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {useFlamegraphPreferencesValue} from 'sentry/utils/profiling/flamegraph/useFlamegraphPreferences';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';

interface ProfilingFlamechartLayoutProps {
  flamechart: React.ReactNode;
  frameStack: React.ReactNode | null;
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
          {props.frameStack ? (
            <FrameStackContainer>{props.frameStack}</FrameStackContainer>
          ) : null}
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
      ? 'auto 1fr'
      : '1fr auto'};

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
        "minimap frame-stack"
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

const FrameStackContainer = styled('div')`
  grid-area: frame-stack;
`;
