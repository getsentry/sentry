import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {
  deleteMonitorEnvironment,
  setEnvironmentIsMuted,
} from 'sentry/actionCreators/monitors';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {Text} from 'sentry/components/core/text';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getNextCheckInEnv} from 'sentry/views/alerts/rules/crons/utils';
import type {Monitor, MonitorBucket} from 'sentry/views/insights/crons/types';
import {makeMonitorDetailsQueryKey} from 'sentry/views/insights/crons/utils';

import {useMonitorStats} from './../utils/useMonitorStats';
import {OverviewRow} from './overviewTimeline/overviewRow';
import {CronServiceIncidents} from './serviceIncidents';

interface Props {
  monitor: Monitor;
  /**
   * Called when an environment is updated (muted/unmuted/deleted).
   */
  onEnvironmentUpdated?: () => void;
  /**
   * Called when monitor stats have been loaded for this timeline.
   */
  onStatsLoaded?: (stats: MonitorBucket[]) => void;
}

export function DetailsTimeline({monitor, onStatsLoaded, onEnvironmentUpdated}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const api = useApi();
  const queryClient = useQueryClient();

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: containerWidth} = useDimensions<HTMLDivElement>({elementRef});
  const timelineWidth = useDebouncedValue(containerWidth, 500);

  // Use the nextCheckIn timestamp from the earliest scheduled environment as a
  // queryKey for computing the timeWindowConfig. This means when the
  // nextCheckIn date changes we will recompute the timeWindowConfig
  // timestamps. This is important when a period is used (like last hour)
  const nextCheckIn = getNextCheckInEnv(monitor.environments)?.nextCheckIn;

  const timeWindowConfig = useTimeWindowConfig({
    timelineWidth,
    recomputeQueryKey: [nextCheckIn],
    recomputeOnWindowFocus: true,
  });

  console.log(timeWindowConfig);

  const monitorDetailsQueryKey = makeMonitorDetailsQueryKey(
    organization,
    monitor.project.slug,
    monitor.slug,
    {
      environment: location.query.environment,
    }
  );

  const {data: monitorStats} = useMonitorStats({
    monitors: [monitor.id],
    timeWindowConfig,
  });

  useEffect(
    () => monitorStats?.[monitor.id] && onStatsLoaded?.(monitorStats[monitor.id]!),
    [onStatsLoaded, monitorStats, monitor.id]
  );

  const handleDeleteEnvironment = async (env: string) => {
    const success = await deleteMonitorEnvironment(api, organization.slug, monitor, env);
    if (!success) {
      return;
    }

    setApiQueryData<Monitor>(queryClient, monitorDetailsQueryKey, oldMonitorDetails => {
      return oldMonitorDetails
        ? {
            ...oldMonitorDetails,
            environments: oldMonitorDetails.environments.filter(e => e.name !== env),
          }
        : undefined;
    });

    onEnvironmentUpdated?.();
  };

  const handleToggleMuteEnvironment = async (env: string, isMuted: boolean) => {
    const resp = await setEnvironmentIsMuted(
      api,
      organization.slug,
      monitor,
      env,
      isMuted
    );

    if (resp === null) {
      return;
    }

    // Invalidate the query to refetch the monitor with updated environment data
    queryClient.invalidateQueries({queryKey: monitorDetailsQueryKey});

    onEnvironmentUpdated?.();
  };

  return (
    <TimelineContainer>
      <TimelineWidthTracker ref={elementRef} />
      <Header>
        <TimelineTitle>{t('Check-Ins')}</TimelineTitle>
        <GridLineLabels timeWindowConfig={timeWindowConfig} />
      </Header>
      <AlignedGridLineOverlay
        allowZoom
        showCursor
        resetPaginationOnZoom
        timeWindowConfig={timeWindowConfig}
        additionalUi={<CronServiceIncidents timeWindowConfig={timeWindowConfig} />}
        cursorOverlayAnchor="top"
        cursorOverlayAnchorOffset={10}
      />
      <OverviewRow
        monitor={monitor}
        timeWindowConfig={timeWindowConfig}
        onDeleteEnvironment={handleDeleteEnvironment}
        onToggleMuteEnvironment={handleToggleMuteEnvironment}
        singleMonitorView
      />
    </TimelineContainer>
  );
}

const TimelineContainer = styled(Panel)`
  display: grid;
  grid-template-columns: 135px 1fr;
`;

const Header = styled('div')`
  grid-column: 1/-1;
  display: grid;
  grid-template-columns: subgrid;
  border-bottom: 1px solid ${p => p.theme.border};
  z-index: 1;

  > :last-child {
    box-shadow: -1px 0 0 0 ${p => p.theme.translucentInnerBorder};
  }
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 2;
`;

const AlignedGridLineOverlay = styled(GridLineOverlay)`
  grid-column: 2;
`;

const TimelineTitle = styled(Text)`
  padding: ${space(2)};
  grid-column: 1;
  line-height: 1.2;
  font-weight: bold;
`;
