import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import Tag from 'sentry/components/badge/tag';
import {Button} from 'sentry/components/button';
import {CheckInPlaceholder} from 'sentry/components/checkInTimeline/checkInPlaceholder';
import {CheckInTimeline} from 'sentry/components/checkInTimeline/checkInTimeline';
import type {TimeWindowConfig} from 'sentry/components/checkInTimeline/types';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ActorBadge from 'sentry/components/idBadge/actorBadge';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {IconEllipsis, IconTimer, IconUser} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {fadeIn} from 'sentry/styles/animations';
import {space} from 'sentry/styles/space';
import type {ObjectStatus} from 'sentry/types/core';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import type {Monitor} from 'sentry/views/monitors/types';
import {scheduleAsText} from 'sentry/views/monitors/utils/scheduleAsText';

import {checkInStatusPrecedent, statusToText, tickStyle} from '../../utils';
import {selectCheckInData} from '../../utils/selectCheckInData';
import {useMonitorStats} from '../../utils/useMonitorStats';
import {StatusToggleButton} from '../statusToggleButton';

import MonitorEnvironmentLabel from './monitorEnvironmentLabel';

interface Props {
  monitor: Monitor;
  timeWindowConfig: TimeWindowConfig;
  /**
   * TODO(epurkhiser): Remove once crons exists only in alerts
   */
  linkToAlerts?: boolean;
  onDeleteEnvironment?: (env: string) => Promise<void>;
  onToggleMuteEnvironment?: (env: string, isMuted: boolean) => Promise<void>;
  onToggleStatus?: (monitor: Monitor, status: ObjectStatus) => Promise<void>;
  /**
   * Whether only one monitor is being rendered in a larger view with this component
   * turns off things like zebra striping, hover effect, and showing monitor name
   */
  singleMonitorView?: boolean;
}

const MAX_SHOWN_ENVIRONMENTS = 4;

export function OverviewRow({
  monitor,
  singleMonitorView,
  timeWindowConfig,
  onDeleteEnvironment,
  onToggleMuteEnvironment,
  onToggleStatus,
  linkToAlerts,
}: Props) {
  const organization = useOrganization();

  const {data: monitorStats, isPending} = useMonitorStats({
    monitors: [monitor.id],
    timeWindowConfig,
  });

  const [isExpanded, setExpanded] = useState(
    monitor.environments.length <= MAX_SHOWN_ENVIRONMENTS
  );

  const environments = isExpanded
    ? monitor.environments
    : monitor.environments.slice(0, MAX_SHOWN_ENVIRONMENTS);

  const isDisabled = monitor.status === 'disabled';

  const location = useLocation();
  const query = pick(location.query, ['start', 'end', 'statsPeriod', 'environment']);

  const to = linkToAlerts
    ? {
        pathname: makeAlertsPathname({
          path: `/rules/crons/${monitor.project.slug}/${monitor.slug}/details/`,
          organization,
        }),
        query,
      }
    : {
        pathname: `/organizations/${organization.slug}/crons/${monitor.project.slug}/${monitor.slug}/`,
        query,
      };

  const monitorDetails = singleMonitorView ? null : (
    <DetailsArea>
      <DetailsLink to={to}>
        <DetailsHeadline>
          <Name>{monitor.name}</Name>
        </DetailsHeadline>
        <DetailsContainer>
          <OwnershipDetails>
            <ProjectBadge project={monitor.project} avatarSize={12} disableLink />
            {monitor.owner ? (
              <ActorBadge actor={monitor.owner} avatarSize={12} />
            ) : (
              <UnassignedLabel>
                <IconUser size="xs" />
                {t('Unassigned')}
              </UnassignedLabel>
            )}
          </OwnershipDetails>
          <ScheduleDetails>
            <IconTimer size="xs" />
            {scheduleAsText(monitor.config)}
          </ScheduleDetails>
          <MonitorStatuses>
            {monitor.isMuted && <Tag>{t('Muted')}</Tag>}
            {isDisabled && <Tag>{t('Disabled')}</Tag>}
          </MonitorStatuses>
        </DetailsContainer>
      </DetailsLink>
      <DetailsActions>
        {onToggleStatus && (
          <StatusToggleButton
            monitor={monitor}
            size="xs"
            onToggleStatus={status => onToggleStatus(monitor, status)}
          />
        )}
      </DetailsActions>
    </DetailsArea>
  );

  const environmentActionCreators = [
    (env: string) => ({
      label: t('View Environment'),
      key: 'view',
      to: {pathname: location.pathname, query: {...query, environment: env}},
    }),
    ...(onToggleMuteEnvironment
      ? [
          (env: string, isMuted: boolean) => ({
            label:
              isMuted && !monitor.isMuted
                ? t('Unmute Environment')
                : t('Mute Environment'),
            key: 'mute',
            details: monitor.isMuted ? t('Monitor is muted') : undefined,
            disabled: monitor.isMuted,
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
      as={singleMonitorView ? 'div' : 'li'}
      key={monitor.id}
      isDisabled={isDisabled}
      singleMonitorView={singleMonitorView}
    >
      {monitorDetails}
      <MonitorEnvContainer>
        {environments.map(env => {
          const {name, isMuted} = env;
          return (
            <EnvRow key={name}>
              <MonitorEnvironmentLabel monitorEnv={env} />
              <EnvDropdown
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
        {environments.map(({name: envName}) => (
          <TimelineEnvOuterContainer key={envName}>
            {isPending ? (
              <CheckInPlaceholder />
            ) : (
              <TimelineEnvContainer>
                <CheckInTimeline
                  statusLabel={statusToText}
                  statusStyle={tickStyle}
                  statusPrecedent={checkInStatusPrecedent}
                  timeWindowConfig={timeWindowConfig}
                  bucketedData={selectCheckInData(
                    monitorStats?.[monitor.id] ?? [],
                    envName
                  )}
                />
              </TimelineEnvContainer>
            )}
          </TimelineEnvOuterContainer>
        ))}
      </TimelineContainer>
    </TimelineRow>
  );
}

const DetailsLink = styled(Link)`
  display: block;
  padding: ${space(3)};
  color: ${p => p.theme.textColor};

  &:focus-visible {
    outline: none;
  }
`;

const DetailsArea = styled('div')`
  border-right: 1px solid ${p => p.theme.border};
  border-radius: 0;
  position: relative;
`;

const DetailsHeadline = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-template-columns: 1fr minmax(30px, max-content);
`;

const DetailsContainer = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const OwnershipDetails = styled('div')`
  display: flex;
  gap: ${space(0.75)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const UnassignedLabel = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;

const MonitorStatuses = styled('div')`
  display: flex;
  gap: ${space(0.5)};
`;

const Name = styled('h3')`
  font-size: ${p => p.theme.fontSizeLarge};
  word-break: break-word;
  margin-bottom: ${space(0.5)};
`;

const ScheduleDetails = styled('small')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

interface TimelineRowProps {
  isDisabled?: boolean;
  singleMonitorView?: boolean;
}

const TimelineRow = styled('li')<TimelineRowProps>`
  grid-column: 1/-1;

  display: grid;
  grid-template-columns: subgrid;

  ${p =>
    !p.singleMonitorView &&
    css`
      transition: background 50ms ease-in-out;

      &:nth-child(odd) {
        background: ${p.theme.backgroundSecondary};
      }
      &:hover {
        background: ${p.theme.backgroundTertiary};
      }
      &:has(*:focus-visible) {
        background: ${p.theme.backgroundTertiary};
      }
    `}

  /* Disabled monitors become more opaque */
  --disabled-opacity: ${p => (p.isDisabled ? '0.6' : 'unset')};

  &:last-child {
    border-bottom-left-radius: ${p => p.theme.borderRadius};
    border-bottom-right-radius: ${p => p.theme.borderRadius};
  }
`;

const DetailsActions = styled('div')`
  position: absolute;
  top: 0;
  right: 0;
  opacity: 0;

  /* Align to the center of the heading text */
  height: calc(${p => p.theme.fontSizeLarge} * ${p => p.theme.text.lineHeightHeading});
  margin: ${space(3)};

  /* Show when timeline is hovered / focused */
  ${TimelineRow}:hover &,
  ${DetailsLink}:focus-visible + &,
  &:has(a:focus-visible),
  &:has(button:focus-visible) {
    opacity: 1;
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

const EnvDropdown = styled(DropdownMenu)`
  text-align: left;
`;

const EnvRow = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  justify-content: space-between;
  align-items: center;
  height: calc(${p => p.theme.fontSizeLarge} * ${p => p.theme.text.lineHeightHeading});
`;

const EnvActionButton = styled(Button)`
  padding: ${space(0.5)} ${space(1)};
  display: none;

  ${EnvRow}:hover & {
    display: block;
  }
`;

const TimelineContainer = styled('div')`
  display: flex;
  padding: ${space(3)} 0;
  flex-direction: column;
  gap: ${space(4)};
  contain: content;
  grid-column: 3/-1;
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
