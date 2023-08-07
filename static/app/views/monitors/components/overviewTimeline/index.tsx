import {useRef} from 'react';
import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {Sticky} from 'sentry/components/sticky';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useDimensions} from 'sentry/utils/useDimensions';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {
  GridLineOverlay,
  GridLineTimeLabels,
} from 'sentry/views/monitors/components/overviewTimeline/gridLines';

import {Monitor} from '../../types';

import {ResolutionSelector} from './resolutionSelector';
import {TimelineTableRow} from './timelineTableRow';
import {MonitorBucketData, TimeWindow} from './types';
import {getStartFromTimeWindow, timeWindowConfig} from './utils';

interface Props {
  monitorList: Monitor[];
}

export function OverviewTimeline({monitorList}: Props) {
  const {location} = useRouter();
  const organization = useOrganization();

  const timeWindow: TimeWindow = location.query?.timeWindow ?? '24h';
  const nowRef = useRef<Date>(new Date());
  const start = getStartFromTimeWindow(nowRef.current, timeWindow);
  const {elementRef, width: timelineWidth} = useDimensions<HTMLDivElement>();

  const rollup = Math.floor(
    (timeWindowConfig[timeWindow].elapsedMinutes * 60) / timelineWidth
  );
  const monitorStatsQueryKey = `/organizations/${organization.slug}/monitors-stats/`;
  const {data: monitorStats, isLoading} = useApiQuery<Record<string, MonitorBucketData>>(
    [
      monitorStatsQueryKey,
      {
        query: {
          until: Math.floor(nowRef.current.getTime() / 1000),
          since: Math.floor(start.getTime() / 1000),
          monitor: monitorList.map(m => m.slug),
          resolution: `${rollup}s`,
          ...location.query,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: timelineWidth > 0,
    }
  );

  return (
    <MonitorListPanel>
      <TimelineWidthTracker ref={elementRef} />
      <StickyResolutionSelector>
        <ResolutionSelector />
      </StickyResolutionSelector>
      <StickyGridLineTimeLabels>
        <GridLineTimeLabels
          timeWindow={timeWindow}
          end={nowRef.current}
          width={timelineWidth}
        />
      </StickyGridLineTimeLabels>
      <GridLineOverlay
        stickyCursor
        showCursor={!isLoading}
        timeWindow={timeWindow}
        end={nowRef.current}
        width={timelineWidth}
      />

      {monitorList.map(monitor => (
        <TimelineTableRow
          key={monitor.id}
          monitor={monitor}
          timeWindow={timeWindow}
          bucketedData={monitorStats?.[monitor.slug]}
          end={nowRef.current}
          start={start}
          width={timelineWidth}
        />
      ))}
    </MonitorListPanel>
  );
}

const MonitorListPanel = styled(Panel)`
  display: grid;
  grid-template-columns: 350px 135px 1fr;
`;

const StickyResolutionSelector = styled(Sticky)`
  z-index: 1;
  padding: ${space(1.5)} ${space(2)};
  border-bottom: 1px solid ${p => p.theme.border};
  grid-column: 1/3;
  background: ${p => p.theme.background};
  border-top-left-radius: ${p => p.theme.panelBorderRadius};

  &[data-stuck] {
    border-radius: 0;
    border-left: 1px solid ${p => p.theme.border};
    margin-left: -1px;
  }
`;

const StickyGridLineTimeLabels = styled(Sticky)`
  > * {
    height: 100%;
  }
  z-index: 1;
  background: ${p => p.theme.background};
  border-top-right-radius: ${p => p.theme.panelBorderRadius};

  &[data-stuck] {
    border-radius: 0;
    border-right: 1px solid ${p => p.theme.border};
    margin-right: -1px;
  }
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 3;
`;
