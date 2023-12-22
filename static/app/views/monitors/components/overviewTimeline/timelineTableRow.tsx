import {useState} from 'react';
import {Link} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Tag from 'sentry/components/tag';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {fadeIn} from 'sentry/styles/animations';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {StatusToggleButton} from 'sentry/views/monitors/components/statusToggleButton';
import {Monitor, MonitorStatus} from 'sentry/views/monitors/types';
import {scheduleAsText} from 'sentry/views/monitors/utils';
import {statusIconColorMap} from 'sentry/views/monitors/utils/constants';

import {CheckInTimeline, CheckInTimelineProps} from './checkInTimeline';
import {TimelinePlaceholder} from './timelinePlaceholder';
import {MonitorBucket} from './types';

interface Props extends Omit<CheckInTimelineProps, 'bucketedData' | 'environment'> {
  monitor: Monitor;
  bucketedData?: MonitorBucket[];
  onDeleteEnvironment?: (env: string) => void;
  onToggleMuteEnvironment?: (env: string, isMuted: boolean) => void;
  onToggleStatus?: (monitor: Monitor) => void;
  /**
   * Whether only one monitor is being rendered in a larger view with this component
   * turns off things like zebra striping, hover effect, and showing monitor name
   */
  singleMonitorView?: boolean;
}

const MAX_SHOWN_ENVIRONMENTS = 4;

export function TimelineTableRow({
  monitor,
  bucketedData,
  singleMonitorView,
  onDeleteEnvironment,
  onToggleMuteEnvironment,
  onToggleStatus,
  ...timelineProps
}: Props) {
  const organization = useOrganization();

  const [isExpanded, setExpanded] = useState(
    monitor.environments.length <= MAX_SHOWN_ENVIRONMENTS
  );

  const environments = isExpanded
    ? monitor.environments
    : monitor.environments.slice(0, MAX_SHOWN_ENVIRONMENTS);

  const isDisabled = monitor.status === 'disabled';

  const monitorDetails = singleMonitorView ? null : (
    <DetailsArea>
      <DetailsLink to={`/organizations/${organization.slug}/crons/${monitor.slug}/`}>
        <DetailsHeadline>
          <Name>{monitor.name}</Name>
          {isDisabled && <Tag>{t('Disabled')}</Tag>}
        </DetailsHeadline>
        <Schedule>{scheduleAsText(monitor.config)}</Schedule>
      </DetailsLink>
      <DetailsActions>
        {onToggleStatus && (
          <StatusToggleButton
            monitor={monitor}
            size="xs"
            onClick={() => onToggleStatus(monitor)}
          />
        )}
      </DetailsActions>
    </DetailsArea>
  );

  const environmentActionCreators = [
    (env: string) => ({
      label: t('View Environment'),
      key: 'view',
      to: `/organizations/${organization.slug}/crons/${monitor.slug}/?environment=${env}`,
    }),
    ...(onToggleMuteEnvironment
      ? [
          (env: string, isMuted: boolean) => ({
            label: isMuted ? t('Unmute Environment') : t('Mute Environment'),
            key: 'mute',
            onAction: () => onToggleMuteEnvironment(env, !isMuted),
          }),
        ]
      : []),
    ...(onDeleteEnvironment
      ? [
          (env: string) => ({
            label: t('Delete Environment'),
            key: 'delete',
            onAction: () => {
              openConfirmModal({
                onConfirm: () => onDeleteEnvironment(env),
                header: t('Delete Environment?'),
                message: tct(
                  'Are you sure you want to permanently delete the "[envName]" environment?',
                  {envName: env}
                ),
                confirmText: t('Delete'),
                priority: 'danger',
              });
            },
          }),
        ]
      : []),
  ];

  return (
    <TimelineRow
      key={monitor.id}
      isDisabled={isDisabled}
      singleMonitorView={singleMonitorView}
    >
      {monitorDetails}
      <MonitorEnvContainer>
        {environments.map(({name, status, isMuted}) => {
          const envStatus = monitor.isMuted || isMuted ? MonitorStatus.DISABLED : status;
          const {label, icon} = statusIconColorMap[envStatus];
          return (
            <EnvRow key={name}>
              <DropdownMenu
                size="sm"
                trigger={triggerProps => (
                  <EnvActionButton
                    {...triggerProps}
                    aria-label={t('Monitor environment actions')}
                    size="xs"
                    icon={<IconEllipsis />}
                  />
                )}
                items={environmentActionCreators.map(actionCreator =>
                  actionCreator(name, isMuted)
                )}
              />
              <EnvWithStatus>
                <MonitorEnvLabel status={envStatus}>{name}</MonitorEnvLabel>
                <Tooltip title={label} skipWrapper>
                  {icon}
                </Tooltip>
              </EnvWithStatus>
            </EnvRow>
          );
        })}
        {!isExpanded && (
          <Button size="xs" onClick={() => setExpanded(true)}>
            {tct('Show [num] More', {
              num: monitor.environments.length - MAX_SHOWN_ENVIRONMENTS,
            })}
          </Button>
        )}
      </MonitorEnvContainer>

      <TimelineContainer>
        {environments.map(({name}) => {
          return (
            <TimelineEnvOuterContainer key={name}>
              {!bucketedData ? (
                <TimelinePlaceholder />
              ) : (
                <TimelineEnvContainer>
                  <CheckInTimeline
                    {...timelineProps}
                    bucketedData={bucketedData}
                    environment={name}
                  />
                </TimelineEnvContainer>
              )}
            </TimelineEnvOuterContainer>
          );
        })}
      </TimelineContainer>
    </TimelineRow>
  );
}

const DetailsLink = styled(Link)`
  display: block;
  padding: ${space(3)};
  color: ${p => p.theme.textColor};
`;

const DetailsArea = styled('div')`
  border-right: 1px solid ${p => p.theme.border};
  border-radius: 0;
  position: relative;
`;

const DetailsActions = styled('div')`
  position: absolute;
  top: 0;
  right: 0;
  display: none;
  align-items: center;

  /* Align to the center of the heading text */
  height: calc(${p => p.theme.fontSizeLarge} * ${p => p.theme.text.lineHeightHeading});
  margin: ${space(3)};
`;

const DetailsHeadline = styled('div')`
  display: grid;
  gap: ${space(1)};

  /* We always leave at least enough room for the status toggle button */
  grid-template-columns: 1fr minmax(30px, max-content);
`;

const Name = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(0.25)};
  word-break: break-word;
`;

const Schedule = styled('small')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

interface TimelineRowProps {
  isDisabled?: boolean;
  singleMonitorView?: boolean;
}

const TimelineRow = styled('div')<TimelineRowProps>`
  display: contents;

  ${p =>
    !p.singleMonitorView &&
    css`
      &:nth-child(odd) > * {
        background: ${p.theme.backgroundSecondary};
      }
      &:hover > * {
        background: ${p.theme.backgroundTertiary};
      }
    `}

  /* Show detail actions on hover */
  &:hover ${DetailsActions} {
    display: flex;
  }

  /* Hide trailing items on hover */
  &:hover ${DetailsHeadline} ${Tag} {
    visibility: hidden;
  }

  /* Disabled monitors become more opaque */
  --disabled-opacity: ${p => (p.isDisabled ? '0.6' : 'unset')};

  &:last-child > *:first-child {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
  }

  &:last-child > *:last-child {
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }

  > * {
    transition: background 50ms ease-in-out;
  }
`;

const MonitorEnvContainer = styled('div')`
  display: flex;
  padding: ${space(3)} ${space(2)};
  gap: ${space(4)};
  flex-direction: column;
  border-right: 1px solid ${p => p.theme.innerBorder};
  text-align: right;
`;

const EnvActionButton = styled(Button)`
  padding: ${space(0.5)} ${space(1)};
  display: none;
`;

const EnvRow = styled('div')`
  &:hover ${EnvActionButton} {
    display: block;
  }

  display: flex;
  gap: ${space(0.5)};
  justify-content: space-between;
  align-items: center;
  height: calc(${p => p.theme.fontSizeLarge} * ${p => p.theme.text.lineHeightHeading});
`;

const EnvWithStatus = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(0.5)};
  align-items: center;
  opacity: var(--disabled-opacity);
`;

const MonitorEnvLabel = styled('div')<{status: MonitorStatus}>`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  min-width: 0;

  color: ${p => p.theme[statusIconColorMap[p.status].color]};
  opacity: var(--disabled-opacity);
`;

const TimelineContainer = styled('div')`
  display: flex;
  padding: ${space(3)} 0;
  flex-direction: column;
  gap: ${space(4)};
  contain: content;
`;

const TimelineEnvOuterContainer = styled('div')`
  position: relative;
  height: calc(${p => p.theme.fontSizeLarge} * ${p => p.theme.text.lineHeightHeading});
  opacity: var(--disabled-opacity);
`;

const TimelineEnvContainer = styled('div')`
  position: absolute;
  inset: 0;
  opacity: 0;
  animation: ${fadeIn} 1.5s ease-out forwards;
  contain: content;
`;
