import {Fragment} from 'react';
import styled from '@emotion/styled';

import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';

interface ProfilingFlamechartLayoutProps {
  flamechart: React.ReactNode;
  frameStack: React.ReactNode | null;
  layoutType: 'minimap_top';
  minimap: React.ReactNode;
}

export function ProfilingFlamechartLayout(props: ProfilingFlamechartLayoutProps) {
  const flamegraphTheme = useFlamegraphTheme();

  return (
    <Fragment>
      <ProfilingFlamechartLayoutContainer>
        <ProfilingFlamechartGrid layoutType={props.layoutType}>
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
  layoutType?: ProfilingFlamechartLayoutProps['layoutType'];
}>`
  display: grid;
  width: 100%;
  grid-template-rows: ${({layoutType}) =>
    layoutType === 'minimap_top'
      ? 'auto 1fr'
      : layoutType === 'table_right'
      ? 'auto 1fr'
      : '1fr auto'};

  /* false positive for grid layout */
  /* stylelint-disable */
  grid-template-areas: ${({layoutType}) =>
    layoutType === 'minimap_top'
      ? `
        "minimap"
        "flamegraph"
        "frame-stack"
        `
      : layoutType === 'table_right'
      ? `
        "minimap frame-stack"
        "flamegraph frame-stack"
      `
      : `
        "flamegraph"
        "frame-stack"
        "minimap"
    `};
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
