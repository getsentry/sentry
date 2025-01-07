import {useEffect, useRef} from 'react';
import styled from '@emotion/styled';

import {
  deleteMonitorEnvironment,
  setEnvironmentIsMuted,
} from 'sentry/actionCreators/monitors';
import Panel from 'sentry/components/panels/panel';
import Text from 'sentry/components/text';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {setApiQueryData, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import type {Monitor} from 'sentry/views/monitors/types';
import {makeMonitorDetailsQueryKey} from 'sentry/views/monitors/utils';

import {OverviewRow} from './overviewTimeline/overviewRow';
import {GridLineLabels, GridLineOverlay} from './timeline/gridLines';
import {useMonitorStats} from './timeline/hooks/useMonitorStats';
import {useTimeWindowConfig} from './timeline/hooks/useTimeWindowConfig';
import type {MonitorBucket} from './timeline/types';

interface Props {
  monitor: Monitor;
  /**
   * Called when monitor stats have been loaded for this timeline.
   */
  onStatsLoaded: (stats: MonitorBucket[]) => void;
}

export function DetailsTimeline({monitor, onStatsLoaded}: Props) {
  const organization = useOrganization();
  const location = useLocation();
  const api = useApi();
  const queryClient = useQueryClient();

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: timelineWidth} = useDimensions<HTMLDivElement>({elementRef});

  const timeWindowConfig = useTimeWindowConfig({timelineWidth});

  const monitorDetailsQueryKey = makeMonitorDetailsQueryKey(
    organization,
    monitor.project.slug,
    monitor.slug,
    {...location.query}
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

    setApiQueryData(queryClient, monitorDetailsQueryKey, (oldMonitorDetails: Monitor) => {
      const newEnvList = oldMonitorDetails.environments.filter(e => e.name !== env);
      const newMonitorDetails = {
        ...oldMonitorDetails,
        environments: newEnvList,
      };

      return newMonitorDetails;
    });
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

    setApiQueryData(queryClient, monitorDetailsQueryKey, (oldMonitorDetails: Monitor) => {
      const oldMonitorEnvIdx = oldMonitorDetails.environments.findIndex(
        monitorEnv => monitorEnv.name === env
      );
      if (oldMonitorEnvIdx < 0) {
        return oldMonitorDetails;
      }

      oldMonitorDetails.environments[oldMonitorEnvIdx] = {
        ...oldMonitorDetails.environments[oldMonitorEnvIdx]!,
        isMuted,
      };
      return oldMonitorDetails;
    });
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
        showIncidents
        timeWindowConfig={timeWindowConfig}
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
  ${p => p.theme.text.cardTitle};
  padding: ${space(2)};
  grid-column: 1;
`;
