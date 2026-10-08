import {useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useDebouncedValue} from '@tanstack/react-pacer';
import {useQueryClient} from '@tanstack/react-query';
import pick from 'lodash/pick';

import {Button} from '@sentry/scraps/button';
import {DropdownMenu} from '@sentry/scraps/dropdownMenu';
import {Table, type TableColumnConfig} from '@sentry/scraps/table';

import {
  deleteMonitorEnvironment,
  setEnvironmentIsMuted,
} from 'sentry/actionCreators/monitors';
import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import {
  GridLineLabels,
  GridLineOverlay,
} from 'sentry/components/checkInTimeline/gridLines';
import {useTimeWindowConfig} from 'sentry/components/checkInTimeline/hooks/useTimeWindowConfig';
import {openConfirmModal} from 'sentry/components/confirm';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {fadeIn} from 'sentry/styles/animations';
import {getNextCheckInEnv} from 'sentry/utils/monitor/cron';
import {setApiQueryData} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {Monitor, MonitorBucket} from 'sentry/views/insights/crons/types';
import {
  checkInStatusPrecedent,
  makeMonitorDetailsQueryKey,
  statusToText,
  tickStyle,
} from 'sentry/views/insights/crons/utils';
import {selectCheckInData} from 'sentry/views/insights/crons/utils/selectCheckInData';
import {useMonitorStats} from 'sentry/views/insights/crons/utils/useMonitorStats';

import {MonitorEnvironmentLabel} from './overviewTimeline/monitorEnvironmentLabel';
import {CronServiceIncidents} from './serviceIncidents';

const ENVIRONMENT_COLUMN_WIDTH = 135;

const MAX_SHOWN_ENVIRONMENTS = 4;

const COLUMNS: TableColumnConfig[] = [
  {key: 'environment', width: `${ENVIRONMENT_COLUMN_WIDTH}px`},
  {key: 'timeline', width: '1fr'},
];

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

  const elementRef = useRef<HTMLTableCellElement>(null);
  const {width: containerWidth} = useDimensions({elementRef});
  const [timelineWidth] = useDebouncedValue(containerWidth, {wait: 500});

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

  const monitorDetailsQueryKey = makeMonitorDetailsQueryKey(
    organization,
    monitor.project.slug,
    monitor.slug,
    {
      environment: location.query.environment,
    }
  );

  const {data: monitorStats, isPending} = useMonitorStats({
    monitors: [monitor.id],
    timeWindowConfig,
  });

  useEffect(
    () => monitorStats?.[monitor.id] && onStatsLoaded?.(monitorStats[monitor.id]!),
    [onStatsLoaded, monitorStats, monitor.id]
  );

  const [isExpanded, setExpanded] = useState(
    monitor.environments.length <= MAX_SHOWN_ENVIRONMENTS
  );

  const environments = isExpanded
    ? monitor.environments
    : monitor.environments.slice(0, MAX_SHOWN_ENVIRONMENTS);

  const query = pick(location.query, ['start', 'end', 'statsPeriod', 'environment']);

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
    <SimpleTable
      aria-label={t('Check-in timeline')}
      columns={COLUMNS}
      density="comfortable"
      header={
        <TimelineHeaderRow>
          <SimpleTable.HeaderCell>{t('Check-Ins')}</SimpleTable.HeaderCell>
          <TimelineHeaderCell ref={elementRef} scope="col" aria-label={t('Timeline')}>
            <GridLineLabels timeWindowConfig={timeWindowConfig} />
            <TimelineOverlay
              allowZoom
              showCursor
              resetPaginationOnZoom
              timeWindowConfig={timeWindowConfig}
              additionalUi={<CronServiceIncidents timeWindowConfig={timeWindowConfig} />}
              cursorOverlayAnchor="top"
              cursorOverlayAnchorOffset={10}
            />
          </TimelineHeaderCell>
        </TimelineHeaderRow>
      }
    >
      {environments.map(env => (
        <SimpleTable.Row
          key={env.name}
          variant={monitor.status === 'disabled' ? 'faded' : 'default'}
        >
          <SimpleTable.RowCell justify="between" gap="xs">
            <MonitorEnvironmentLabel monitorEnv={env} />
            <DropdownMenu
              size="sm"
              usePortal
              strategy="fixed"
              trigger={triggerProps => (
                <EnvironmentActionsButton
                  {...triggerProps}
                  aria-label={t('Monitor environment actions')}
                  size="zero"
                  icon={<IconEllipsis />}
                />
              )}
              items={[
                {
                  key: 'view',
                  label: t('View Environment'),
                  to: {
                    pathname: location.pathname,
                    query: {...query, environment: env.name},
                  },
                },
                {
                  key: 'mute',
                  label: env.isMuted ? t('Unmute Environment') : t('Mute Environment'),
                  onAction: () => handleToggleMuteEnvironment(env.name, !env.isMuted),
                },
                {
                  key: 'delete',
                  label: t('Delete Environment'),
                  onAction: () =>
                    openConfirmModal({
                      onConfirm: () => handleDeleteEnvironment(env.name),
                      header: t('Delete Environment?'),
                      message: tct(
                        'Are you sure you want to remove the "[envName]" environment and delete the associated check-ins from this Cron Monitor?',
                        {envName: env.name}
                      ),
                      confirmText: t('Delete'),
                      priority: 'danger',
                    }),
                },
              ]}
            />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell padding="lg 0">
            {isPending ? (
              <CheckInPlaceholder />
            ) : (
              <TimelineFadeIn>
                <CheckInTimeline
                  statusLabel={statusToText}
                  statusStyle={tickStyle}
                  statusPrecedent={checkInStatusPrecedent}
                  timeWindowConfig={timeWindowConfig}
                  bucketedData={selectCheckInData(
                    monitorStats?.[monitor.id] ?? [],
                    env.name
                  )}
                />
              </TimelineFadeIn>
            )}
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
      {!isExpanded && (
        <SimpleTable.Row>
          <SimpleTable.RowCell>
            <Button size="xs" onClick={() => setExpanded(true)}>
              {tct('Show [num] More', {
                num: monitor.environments.length - MAX_SHOWN_ENVIRONMENTS,
              })}
            </Button>
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      )}
    </SimpleTable>
  );
}

// The overlay spans the timeline column of every row, so it positions against
// the table rather than the header row or cell it is rendered in.
const TimelineHeaderRow = styled(SimpleTable.HeaderRow)`
  position: static;
`;

const TimelineHeaderCell = styled(Table.HeadCell)`
  position: static;
  flex-direction: column;
`;

const TimelineOverlay = styled(GridLineOverlay)`
  inset: 0 0 0 ${ENVIRONMENT_COLUMN_WIDTH}px;
  width: auto;
  height: auto;
`;

// The negative margin keeps the row from growing when the button appears on hover.
// The menu is portaled out of the row, so an open menu has to keep its trigger shown.
const EnvironmentActionsButton = styled(Button)`
  margin-block: -${p => p.theme.space.xs};

  tr:not(:hover) &:not([aria-expanded='true']) {
    display: none;
  }
`;

const TimelineFadeIn = styled('div')`
  width: 100%;
  opacity: 0;
  animation: ${fadeIn} 1.5s ease-out forwards;
`;
