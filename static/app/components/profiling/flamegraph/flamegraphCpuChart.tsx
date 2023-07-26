import {CSSProperties, Fragment} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {CanvasPoolManager} from 'sentry/utils/profiling/canvasScheduler';
import type {FlamegraphChart} from 'sentry/utils/profiling/flamegraphChart';
import {useProfiles} from 'sentry/views/profiling/profilesProvider';

import {
  CollapsibleTimelineLoadingIndicator,
  CollapsibleTimelineMessage,
} from './collapsibleTimeline';

interface FlamegraphChartProps {
  canvasPoolManager: CanvasPoolManager;
  chart: FlamegraphChart | null;
}

export function FlamegraphCpuChart(props: FlamegraphChartProps) {
  const profiles = useProfiles();

  return (
    <Fragment>
      <Canvas style={{display: 'none'}} />
      {/* transaction loads after profile, so we want to show loading even if it's in initial state */}
      {profiles.type === 'loading' || profiles.type === 'initial' ? (
        <CollapsibleTimelineLoadingIndicator />
      ) : profiles.type === 'resolved' && !props.chart?.series.length ? (
        <CollapsibleTimelineMessage>
          {t('Profile has no CPU measurements')}
        </CollapsibleTimelineMessage>
      ) : null}
    </Fragment>
  );
}

const Canvas = styled('canvas')<{cursor?: CSSProperties['cursor']}>`
  width: 100%;
  height: 100%;
  position: absolute;
  left: 0;
  top: 0;
  user-select: none;
  cursor: ${p => p.cursor};
`;
