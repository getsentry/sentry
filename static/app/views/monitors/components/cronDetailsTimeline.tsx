import {useRef} from 'react';
import styled from '@emotion/styled';
import moment from 'moment';

import {
  deleteMonitorEnvironment,
  setEnvironmentIsMuted,
} from 'sentry/actionCreators/monitors';
import Panel from 'sentry/components/panels/panel';
import Text from 'sentry/components/text';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {parsePeriodToHours} from 'sentry/utils/dates';
import {setApiQueryData, useApiQuery, useQueryClient} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useDimensions} from 'sentry/utils/useDimensions';
import usePageFilters from 'sentry/utils/usePageFilters';
import useRouter from 'sentry/utils/useRouter';
import {
  GridLineOverlay,
  GridLineTimeLabels,
} from 'sentry/views/monitors/components/overviewTimeline/gridLines';
import {TimelineTableRow} from 'sentry/views/monitors/components/overviewTimeline/timelineTableRow';
import {MonitorBucketData} from 'sentry/views/monitors/components/overviewTimeline/types';
import {getConfigFromTimeRange} from 'sentry/views/monitors/components/overviewTimeline/utils';
import {Monitor} from 'sentry/views/monitors/types';
import {makeMonitorDetailsQueryKey} from 'sentry/views/monitors/utils';

interface Props {
  monitor: Monitor;
  organization: Organization;
}

export function CronDetailsTimeline({monitor, organization}: Props) {
  const {location} = useRouter();
  const api = useApi();
  const queryClient = useQueryClient();
  const nowRef = useRef<Date>(new Date());
  const {selection} = usePageFilters();
  const {period} = selection.datetime;
  let {end, start} = selection.datetime;

  if (!start || !end) {
    end = nowRef.current;
    start = moment(end)
      .subtract(parsePeriodToHours(period ?? '24h'), 'hour')
      .toDate();
  } else {
    start = new Date(start);
    end = new Date(end);
  }

  const elementRef = useRef<HTMLDivElement>(null);
  const {width: timelineWidth} = useDimensions<HTMLDivElement>({elementRef});
  const config = getConfigFromTimeRange(start, end, timelineWidth);

  const elapsedMinutes = config.elapsedMinutes;
  const rollup = Math.floor((elapsedMinutes * 60) / timelineWidth);

  const monitorStatsQueryKey = `/organizations/${organization.slug}/monitors-stats/`;
  const {data: monitorStats, isLoading} = useApiQuery<Record<string, MonitorBucketData>>(
    [
      monitorStatsQueryKey,
      {
        query: {
          until: Math.floor(end.getTime() / 1000),
          since: Math.floor(start.getTime() / 1000),
          monitor: monitor.slug,
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

  const monitorDetailsQueryKey = makeMonitorDetailsQueryKey(organization, monitor.slug, {
    ...location.query,
  });

  const handleDeleteEnvironment = async (env: string) => {
    const success = await deleteMonitorEnvironment(
      api,
      organization.slug,
      monitor.slug,
      env
    );
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
      monitor.slug,
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
      <TimelineTitle>{t('Check-Ins')}</TimelineTitle>
      <StyledGridLineTimeLabels
        timeWindowConfig={config}
        start={start}
        end={end}
        width={timelineWidth}
      />
      <StyledGridLineOverlay
        showCursor={!isLoading}
        timeWindowConfig={config}
        start={start}
        end={end}
        width={timelineWidth}
      />
      <TimelineTableRow
        monitor={monitor}
        bucketedData={monitorStats?.[monitor.slug]}
        timeWindowConfig={config}
        end={end}
        start={start}
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

const StyledGridLineTimeLabels = styled(GridLineTimeLabels)`
  grid-column: 2;
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
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${space(2)};
`;
