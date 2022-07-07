import styled from '@emotion/styled';

import {FlamegraphTheme} from 'sentry/utils/profiling/flamegraph/flamegraphTheme';
import {useFlamegraphTheme} from 'sentry/utils/profiling/flamegraph/useFlamegraphTheme';

interface ProfilingFlamechartLayoutProps {
  flamechart: React.ReactNode;
  layoutType: 'minimap_top';
  minimap: React.ReactNode;
}

export function ProfilingFlamechartLayout(props: ProfilingFlamechartLayoutProps) {
  const flamegraphTheme = useFlamegraphTheme();

  return (
    <ProfilingFlamechartLayoutContainer>
      <ProfilingFlamechartGrid layoutType={props.layoutType}>
        <MinimapContainer height={flamegraphTheme.SIZES.MINIMAP_HEIGHT}>
          {props.minimap}
        </MinimapContainer>
        <ZoomViewContainer>{props.flamechart}</ZoomViewContainer>
      </ProfilingFlamechartGrid>
    </ProfilingFlamechartLayoutContainer>
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
    layoutType === 'minimap_top' ? 'auto 1fr' : '1fr auto'};
  grid-template-areas: ${({layoutType}) =>
    layoutType === 'minimap_top'
      ? `
    'minimap'
    'flamegraph'`
      : `
    'flamegraph'
    'minimap'`};
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
