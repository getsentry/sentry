import {useState} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import AlertBadge from 'sentry/components/alertBadge';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import {openConfirmModal} from 'sentry/components/confirm';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import DropdownBubble from 'sentry/components/dropdownBubble';
import {DropdownMenu, MenuItemProps} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Highlight from 'sentry/components/highlight';
import IdBadge from 'sentry/components/idBadge';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {
  IconArrow,
  IconChevron,
  IconEllipsis,
  IconMute,
  IconNot,
  IconUser,
} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Actor, Project} from 'sentry/types';
import type {ColorOrAlias} from 'sentry/utils/theme';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import {getThresholdUnits} from 'sentry/views/alerts/rules/metric/constants';
import {
  AlertRuleComparisonType,
  AlertRuleThresholdType,
  AlertRuleTriggerType,
} from 'sentry/views/alerts/rules/metric/types';

import {CombinedAlertType, CombinedMetricIssueAlerts, IncidentStatus} from '../../types';
import {isIssueAlert} from '../../utils';

type Props = {
  hasEditAccess: boolean;
  onDelete: (projectId: string, rule: CombinedMetricIssueAlerts) => void;
  onOwnerChange: (
    projectId: string,
    rule: CombinedMetricIssueAlerts,
    ownerValue: string
  ) => void;
  orgId: string;
  projects: Project[];
  projectsLoaded: boolean;
  rule: CombinedMetricIssueAlerts;
};

function RuleListRow({
  rule,
  projectsLoaded,
  projects,
  orgId,
  onDelete,
  onOwnerChange,
  hasEditAccess,
}: Props) {
  const {teams: userTeams} = useUserTeams();
  const [assignee, setAssignee] = useState<string>('');
  const activeIncident =
    rule.latestIncident?.status !== undefined &&
    [IncidentStatus.CRITICAL, IncidentStatus.WARNING].includes(
      rule.latestIncident.status
    );

  function renderLastIncidentDate(): React.ReactNode {
    if (isIssueAlert(rule)) {
      if (!rule.lastTriggered) {
        return t('Alert not triggered yet');
      }
      return (
        <div>
          {t('Triggered ')}
          <TimeSince date={rule.lastTriggered} />
        </div>
      );
    }

    if (!rule.latestIncident) {
      return t('Alert not triggered yet');
    }

    if (activeIncident) {
      return (
        <div>
          {t('Triggered ')}
          <TimeSince date={rule.latestIncident.dateCreated} />
        </div>
      );
    }

    return (
      <div>
        {t('Resolved ')}
        <TimeSince date={rule.latestIncident.dateClosed!} />
      </div>
    );
  }

  function renderSnoozeStatus(): React.ReactNode {
    return (
      <IssueAlertStatusWrapper>
        <IconMute size="sm" color="subText" />
        {t('Muted')}
      </IssueAlertStatusWrapper>
    );
  }

  function renderAlertRuleStatus(): React.ReactNode {
    if (isIssueAlert(rule)) {
      if (rule.status === 'disabled') {
        return (
          <IssueAlertStatusWrapper>
            <IconNot size="sm" color="subText" />
            {t('Disabled')}
          </IssueAlertStatusWrapper>
        );
      }
      if (rule.snooze) {
        return renderSnoozeStatus();
      }
      return null;
    }

    if (rule.snooze) {
      return renderSnoozeStatus();
    }

    const criticalTrigger = rule.triggers.find(
      ({label}) => label === AlertRuleTriggerType.CRITICAL
    );
    const warningTrigger = rule.triggers.find(
      ({label}) => label === AlertRuleTriggerType.WARNING
    );
    const resolvedTrigger = rule.resolveThreshold;
    const trigger =
      activeIncident && rule.latestIncident?.status === IncidentStatus.CRITICAL
        ? criticalTrigger
        : warningTrigger ?? criticalTrigger;

    let iconColor: ColorOrAlias = 'successText';
    let iconDirection: 'up' | 'down' | undefined;
    let thresholdTypeText =
      activeIncident && rule.thresholdType === AlertRuleThresholdType.ABOVE
        ? t('Above')
        : t('Below');

    if (activeIncident) {
      iconColor =
        trigger?.label === AlertRuleTriggerType.CRITICAL
          ? 'errorText'
          : trigger?.label === AlertRuleTriggerType.WARNING
          ? 'warningText'
          : 'successText';
      iconDirection = rule.thresholdType === AlertRuleThresholdType.ABOVE ? 'up' : 'down';
    } else {
      // Use the Resolved threshold type, which is opposite of Critical
      iconDirection = rule.thresholdType === AlertRuleThresholdType.ABOVE ? 'down' : 'up';
      thresholdTypeText =
        rule.thresholdType === AlertRuleThresholdType.ABOVE ? t('Below') : t('Above');
    }

    return (
      <FlexCenter>
        <IconArrow color={iconColor} direction={iconDirection} />
        <TriggerText>
          {`${thresholdTypeText} ${
            rule.latestIncident || (!rule.latestIncident && !resolvedTrigger)
              ? trigger?.alertThreshold?.toLocaleString()
              : resolvedTrigger?.toLocaleString()
          }`}
          {getThresholdUnits(
            rule.aggregate,
            rule.comparisonDelta
              ? AlertRuleComparisonType.CHANGE
              : AlertRuleComparisonType.COUNT
          )}
        </TriggerText>
      </FlexCenter>
    );
  }

  const slug = rule.projects[0];
  const editLink = `/organizations/${orgId}/alerts/${
    isIssueAlert(rule) ? 'rules' : 'metric-rules'
  }/${slug}/${rule.id}/`;

  const duplicateLink = {
    pathname: `/organizations/${orgId}/alerts/new/${
      rule.type === CombinedAlertType.METRIC ? 'metric' : 'issue'
    }/`,
    query: {
      project: slug,
      duplicateRuleId: rule.id,
      createFromDuplicate: true,
      referrer: 'alert_stream',
    },
  };

  const ownerId = rule.owner?.split(':')[1];
  const teamActor = ownerId
    ? {type: 'team' as Actor['type'], id: ownerId, name: ''}
    : null;

  const canEdit = ownerId ? userTeams.some(team => team.id === ownerId) : true;

  const IssueStatusText: Record<IncidentStatus, string> = {
    [IncidentStatus.CRITICAL]: t('Critical'),
    [IncidentStatus.WARNING]: t('Warning'),
    [IncidentStatus.CLOSED]: t('Resolved'),
    [IncidentStatus.OPENED]: t('Resolved'),
  };

  const actions: MenuItemProps[] = [
    {
      key: 'edit',
      label: t('Edit'),
      to: editLink,
    },
    {
      key: 'duplicate',
      label: t('Duplicate'),
      to: duplicateLink,
    },
    {
      key: 'delete',
      label: t('Delete'),
      priority: 'danger',
      onAction: () => {
        openConfirmModal({
          onConfirm: () => onDelete(slug, rule),
          header: <h5>{t('Delete Alert Rule?')}</h5>,
          message: t(
            'Are you sure you want to delete "%s"? You won\'t be able to view the history of this alert once it\'s deleted.',
            rule.name
          ),
          confirmText: t('Delete Rule'),
          priority: 'danger',
        });
      },
    },
  ];

  function handleOwnerChange({value}: {value: string}) {
    const ownerValue = value && `team:${value}`;
    setAssignee(ownerValue);
    onOwnerChange(slug, rule, ownerValue);
  }

  const unassignedOption = {
    value: '',
    label: () => (
      <MenuItemWrapper>
        <StyledIconUser size="md" />
        {t('Unassigned')}
      </MenuItemWrapper>
    ),
    searchKey: 'unassigned',
    actor: '',
    disabled: false,
  };

  const project = projects.find(p => p.slug === slug);
  const filteredProjectTeams = (project?.teams ?? []).filter(projTeam => {
    return userTeams.some(team => team.id === projTeam.id);
  });
  const dropdownTeams = filteredProjectTeams
    .map((team, idx) => ({
      value: team.id,
      searchKey: team.slug,
      label: ({inputValue}) => (
        <MenuItemWrapper data-test-id="assignee-option" key={idx}>
          <IconContainer>
            <TeamAvatar team={team} size={24} />
          </IconContainer>
          <Label>
            <Highlight text={inputValue}>{`#${team.slug}`}</Highlight>
          </Label>
        </MenuItemWrapper>
      ),
    }))
    .concat(unassignedOption);

  const teamId = assignee?.split(':')[1];
  const teamName = filteredProjectTeams.find(team => team.id === teamId);

  const assigneeTeamActor = assignee && {
    type: 'team' as Actor['type'],
    id: teamId,
    name: '',
  };

  const avatarElement = assigneeTeamActor ? (
    <ActorAvatar
      actor={assigneeTeamActor}
      className="avatar"
      size={24}
      tooltipOptions={{overlayStyle: {textAlign: 'left'}}}
      tooltip={tct('Assigned to [name]', {name: teamName && `#${teamName.name}`})}
    />
  ) : (
    <Tooltip isHoverable skipWrapper title={t('Unassigned')}>
      <StyledIconUser size="md" color="gray400" />
    </Tooltip>
  );

  return (
    <ErrorBoundary>
      <AlertNameWrapper isIssueAlert={isIssueAlert(rule)}>
        <FlexCenter>
          <Tooltip
            title={
              isIssueAlert(rule)
                ? t('Issue Alert')
                : tct('Metric Alert Status: [status]', {
                    status:
                      IssueStatusText[
                        rule?.latestIncident?.status ?? IncidentStatus.CLOSED
                      ],
                  })
            }
          >
            <AlertBadge
              status={rule?.latestIncident?.status}
              isIssue={isIssueAlert(rule)}
            />
          </Tooltip>
        </FlexCenter>
        <AlertNameAndStatus>
          <AlertName>
            <Link
              to={
                isIssueAlert(rule)
                  ? `/organizations/${orgId}/alerts/rules/${rule.projects[0]}/${rule.id}/details/`
                  : `/organizations/${orgId}/alerts/rules/details/${rule.id}/`
              }
            >
              {rule.name}
            </Link>
          </AlertName>
          <AlertIncidentDate>{renderLastIncidentDate()}</AlertIncidentDate>
        </AlertNameAndStatus>
      </AlertNameWrapper>
      <FlexCenter>{renderAlertRuleStatus()}</FlexCenter>
      <FlexCenter>
        <ProjectBadgeContainer>
          <ProjectBadge
            avatarSize={18}
            project={projectsLoaded && project ? project : {slug}}
          />
        </ProjectBadgeContainer>
      </FlexCenter>

      <FlexCenter>
        {teamActor ? (
          <ActorAvatar actor={teamActor} size={24} />
        ) : (
          <AssigneeWrapper>
            {!projectsLoaded && (
              <LoadingIndicator
                mini
                style={{height: '24px', margin: 0, marginRight: 11}}
              />
            )}
            {projectsLoaded && (
              <DropdownAutoComplete
                data-test-id="alert-row-assignee"
                maxHeight={400}
                onOpen={e => {
                  e?.stopPropagation();
                }}
                items={dropdownTeams}
                alignMenu="right"
                onSelect={handleOwnerChange}
                itemSize="small"
                searchPlaceholder={t('Filter teams')}
                disableLabelPadding
                emptyHidesInput
                disabled={!hasEditAccess}
              >
                {({getActorProps, isOpen}) => (
                  <DropdownButton {...getActorProps({})}>
                    {avatarElement}
                    {hasEditAccess && (
                      <StyledChevron direction={isOpen ? 'up' : 'down'} size="xs" />
                    )}
                  </DropdownButton>
                )}
              </DropdownAutoComplete>
            )}
          </AssigneeWrapper>
        )}
      </FlexCenter>
      <ActionsColumn>
        <Access access={['alerts:write']}>
          {({hasAccess}) => (
            <DropdownMenu
              items={actions}
              position="bottom-end"
              triggerProps={{
                'aria-label': t('Actions'),
                size: 'xs',
                icon: <IconEllipsis />,
                showChevron: false,
              }}
              disabledKeys={hasAccess && canEdit ? [] : ['delete']}
            />
          )}
        </Access>
      </ActionsColumn>
    </ErrorBoundary>
  );
}

const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
`;

const IssueAlertStatusWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  line-height: 2;
`;

const AlertNameWrapper = styled('div')<{isIssueAlert?: boolean}>`
  ${p => p.theme.overflowEllipsis}
  display: flex;
  align-items: center;
  gap: ${space(2)};
  ${p => p.isIssueAlert && `padding: ${space(3)} ${space(2)}; line-height: 2.4;`}
`;

const AlertNameAndStatus = styled('div')`
  ${p => p.theme.overflowEllipsis}
  line-height: 1.35;
`;

const AlertName = styled('div')`
  ${p => p.theme.overflowEllipsis}
  font-size: ${p => p.theme.fontSizeLarge};
`;

const AlertIncidentDate = styled('div')`
  color: ${p => p.theme.gray300};
`;

const ProjectBadgeContainer = styled('div')`
  width: 100%;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const TriggerText = styled('div')`
  margin-left: ${space(1)};
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
`;

const ActionsColumn = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)};
`;

const AssigneeWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;

  /* manually align menu underneath dropdown caret */
  ${DropdownBubble} {
    right: -14px;
  }
`;

const DropdownButton = styled('div')`
  display: flex;
  align-items: center;
  font-size: 20px;
`;

const StyledChevron = styled(IconChevron)`
  margin-left: ${space(1)};
`;

const StyledIconUser = styled(IconUser)`
  /* We need this to center with Avatar */
  margin-right: 2px;
`;

const IconContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
`;

const MenuItemWrapper = styled('div')`
  display: flex;
  align-items: center;
  font-size: 13px;
`;

const Label = styled(TextOverflow)`
  margin-left: 6px;
`;

export default RuleListRow;
