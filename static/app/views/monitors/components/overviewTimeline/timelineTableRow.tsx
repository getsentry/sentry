import {useState} from 'react';
import {Link} from 'react-router';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {fadeIn} from 'sentry/styles/animations';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
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
  ...timelineProps
}: Props) {
  const [isExpanded, setExpanded] = useState(
    monitor.environments.length <= MAX_SHOWN_ENVIRONMENTS
  );

  const environments = isExpanded
    ? monitor.environments
    : monitor.environments.slice(0, MAX_SHOWN_ENVIRONMENTS);

  return (
    <TimelineRow key={monitor.id} singleMonitorView={singleMonitorView}>
      {!singleMonitorView && <MonitorDetails monitor={monitor} />}
      <MonitorEnvContainer>
        {environments.map(({name, status}) => {
          const envStatus =
            monitor.status === MonitorStatus.DISABLED ? MonitorStatus.DISABLED : status;
          const {label, icon} = statusIconColorMap[envStatus];
          return (
            <EnvWithStatus key={name}>
              {onDeleteEnvironment && (
                <DropdownMenu
                  size="sm"
                  trigger={triggerProps => (
                    <EnvActionButton
                      {...triggerProps}
                      aria-label={t('Monitor environment actions')}
                      size="zero"
                      icon={<IconEllipsis size="sm" />}
                    />
                  )}
                  items={[
                    {
                      label: t('Delete Environment'),
                      key: 'delete',
                      onAction: () => {
                        openConfirmModal({
                          onConfirm: () => onDeleteEnvironment(name),
                          header: t('Delete Environment?'),
                          message: tct(
                            'Are you sure you want to permanently delete the "[envName]" environment?',
                            {envName: name}
                          ),
                          confirmText: t('Delete'),
                          priority: 'danger',
                        });
                      },
                    },
                  ]}
                />
              )}
              <MonitorEnvLabel status={envStatus}>{name}</MonitorEnvLabel>
              <Tooltip title={label} skipWrapper>
                {icon}
              </Tooltip>
            </EnvWithStatus>
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

function MonitorDetails({monitor}: {monitor: Monitor}) {
  const organization = useOrganization();
  const schedule = scheduleAsText(monitor.config);

  const monitorDetailUrl = `/organizations/${organization.slug}/crons/${monitor.slug}/`;

  return (
    <DetailsContainer to={monitorDetailUrl}>
      <Name>{monitor.name}</Name>
      <Schedule>{schedule}</Schedule>
    </DetailsContainer>
  );
}

const TimelineRow = styled('div')<{singleMonitorView?: boolean}>`
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

  > * {
    transition: background 50ms ease-in-out;
  }
`;

const DetailsContainer = styled(Link)`
  color: ${p => p.theme.textColor};
  padding: ${space(3)};
  border-right: 1px solid ${p => p.theme.border};
  border-radius: 0;
`;

const Name = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
  margin-bottom: ${space(0.25)};
`;

const Schedule = styled('small')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
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

const EnvWithStatus = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  height: calc(${p => p.theme.fontSizeLarge} * ${p => p.theme.text.lineHeightHeading});

  &:hover ${EnvActionButton} {
    display: block;
  }
`;

const MonitorEnvLabel = styled('div')<{status: MonitorStatus}>`
  text-overflow: ellipsis;
  overflow: hidden;
  white-space: nowrap;
  flex: 1;

  color: ${p => p.theme[statusIconColorMap[p.status].color]};
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
`;

const TimelineEnvContainer = styled('div')`
  position: absolute;
  inset: 0;
  opacity: 0;
  animation: ${fadeIn} 1.5s ease-out forwards;
  contain: content;
`;
