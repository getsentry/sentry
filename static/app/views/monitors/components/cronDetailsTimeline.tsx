import {useRef} from 'react';
import styled from '@emotion/styled';

import {
  deleteMonitorEnvironment,
  setEnvironmentIsMuted,
} from 'sentry/actionCreators/monitors';
import Panel from 'sentry/components/panels/panel';
import Text from 'sentry/components/text';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useDimensions} from 'sentry/utils/useDimensions';
import useRouter from 'sentry/utils/useRouter';
import {
  GridLineOverlay,
  GridLineTimeLabels,
} from 'sentry/views/monitors/components/overviewTimeline/gridLines';
import {TimelineTableRow} from 'sentry/views/monitors/components/overviewTimeline/timelineTableRow';
import type {MonitorBucketData} from 'sentry/views/monitors/components/overviewTimeline/types';
import type {Monitor} from 'sentry/views/monitors/types';
import {makeMonitorDetailsQueryKey} from 'sentry/views/monitors/utils';
import {useMonitorTimes} from 'sentry/views/monitors/utils/useMonitorDates';

interface Props {
  monitor: Monitor;
  organization: Organization;
}

export function CronDetailsTimeline({monitor, organization}: Props) {
  const {location} = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: timelineWidth} = useDimensions<HTMLDivElement>({elementRef});

  const {dates, selectionQuery, timeWindowConfig} = useMonitorTimes({timelineWidth});

  const monitorStatsQueryKey = `/organizations/${organization.slug}/monitors-stats/`;
  const {data: monitorStats, isLoading} = useApiQuery<Record<string, MonitorBucketData>>(
    [
      monitorStatsQueryKey,
      {
        query: {
          monitor: monitor.slug,
          ...selectionQuery,
          ...location.query,
        },
      },
    ],
    {
      staleTime: 0,
      enabled: timelineWidth > 0,
    }
  );

  const monitorDetailsQueryKey = makeMonitorDetailsQueryKey(
    organization,
    monitor.project.slug,
    monitor.slug,
    {...location.query}
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
        ...oldMonitorDetails.environments[oldMonitorEnvIdx],
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
        <GridLineTimeLabels
          timeWindowConfig={timeWindowConfig}
          start={dates.start}
          end={dates.end}
          width={timelineWidth}
        />
      </Header>
      <StyledGridLineOverlay
        showCursor={!isLoading}
        timeWindowConfig={timeWindowConfig}
        start={dates.start}
        end={dates.end}
        width={timelineWidth}
      />
      <TimelineTableRow
        monitor={monitor}
        bucketedData={monitorStats?.[monitor.slug]}
        timeWindowConfig={timeWindowConfig}
        start={dates.start}
        end={dates.end}
        width={timelineWidth}
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

const StyledGridLineOverlay = styled(GridLineOverlay)`
  grid-column: 2;
`;

const TimelineWidthTracker = styled('div')`
  position: absolute;
  width: 100%;
  grid-row: 1;
  grid-column: 2;
`;

const TimelineTitle = styled(Text)`
  ${p => p.theme.text.cardTitle};
  padding: ${space(2)};
  grid-column: 1;
`;
