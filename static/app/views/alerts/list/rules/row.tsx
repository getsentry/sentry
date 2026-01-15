import {useState} from 'react';
import styled from '@emotion/styled';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import Access from 'sentry/components/acl/access';
import {openConfirmModal} from 'sentry/components/confirm';
import {ActorAvatar} from 'sentry/components/core/avatar/actorAvatar';
import {TeamAvatar} from 'sentry/components/core/avatar/teamAvatar';
import {Tag} from 'sentry/components/core/badge/tag';
import {
  CompactSelect,
  type SelectOptionOrSection,
} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink, Link} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import {IconEllipsis, IconUser} from 'sentry/icons';
import {SvgIcon} from 'sentry/icons/svgIcon';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import AlertLastIncidentActivationInfo from 'sentry/views/alerts/list/rules/alertLastIncidentActivationInfo';
import AlertRuleStatus from 'sentry/views/alerts/list/rules/alertRuleStatus';
import CombinedAlertBadge from 'sentry/views/alerts/list/rules/combinedAlertBadge';
import {getActor} from 'sentry/views/alerts/list/rules/utils';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {UptimeMonitorMode} from 'sentry/views/alerts/rules/uptime/types';
import type {CombinedAlerts} from 'sentry/views/alerts/types';
import {CombinedAlertType} from 'sentry/views/alerts/types';
import {isIssueAlert} from 'sentry/views/alerts/utils';
import {DEPRECATED_TRANSACTION_ALERTS} from 'sentry/views/alerts/wizard/options';
import {getAlertTypeFromAggregateDataset} from 'sentry/views/alerts/wizard/utils';
import {deprecateTransactionAlerts} from 'sentry/views/insights/common/utils/hasEAPAlerts';

type Props = {
  hasEditAccess: boolean;
  onDelete: (projectId: string, rule: CombinedAlerts) => void;
  onOwnerChange: (projectId: string, rule: CombinedAlerts, ownerValue: string) => void;
  organization: Organization;
  projects: Project[];
  projectsLoaded: boolean;
  rule: CombinedAlerts;
};

function RuleListRow({
  rule,
  projectsLoaded,
  projects,
  organization,
  onDelete,
  onOwnerChange,
  hasEditAccess,
}: Props) {
  const {teams: userTeams} = useUserTeams();
  const [assignee, setAssignee] = useState<string>('');

  const isUptime = rule.type === CombinedAlertType.UPTIME;
  const isCron = rule.type === CombinedAlertType.CRONS;

  const slug = isUptime
    ? rule.projectSlug
    : isCron
      ? rule.project.slug
      : rule.projects[0]!;

  const ruleType =
    rule &&
    rule.type === CombinedAlertType.METRIC &&
    getAlertTypeFromAggregateDataset({
      aggregate: rule.aggregate,
      dataset: rule.dataset,
      eventTypes: rule.eventTypes,
      organization,
    });

  const deprecateTransactionsAlerts =
    deprecateTransactionAlerts(organization) &&
    ruleType &&
    DEPRECATED_TRANSACTION_ALERTS.includes(ruleType);

  const editKey = {
    [CombinedAlertType.ISSUE]: 'rules',
    [CombinedAlertType.METRIC]: 'metric-rules',
    [CombinedAlertType.UPTIME]: 'uptime-rules',
    [CombinedAlertType.CRONS]: 'crons-rules',
  } satisfies Record<CombinedAlertType, string>;

  const editLink = makeAlertsPathname({
    path: `/${editKey[rule.type]}/${slug}/${rule.id}/`,
    organization,
  });

  const mutateKey = {
    [CombinedAlertType.ISSUE]: 'issue',
    [CombinedAlertType.METRIC]: 'metric',
    [CombinedAlertType.UPTIME]: 'uptime',
    [CombinedAlertType.CRONS]: 'crons',
  } satisfies Record<CombinedAlertType, string>;

  const duplicateLink = {
    pathname: makeAlertsPathname({
      path: `/new/${mutateKey[rule.type]}/`,
      organization,
    }),
    query: {
      project: slug,
      duplicateRuleId: rule.id,
      createFromDuplicate: 'true',
      referrer: 'alert_stream',
    },
  };

  const ownerActor = getActor(rule);

  const canEdit = ownerActor?.id
    ? userTeams.some(team => team.id === ownerActor.id)
    : true;

  const activeActions = {
    [CombinedAlertType.ISSUE]: ['edit', 'duplicate', 'delete'],
    [CombinedAlertType.METRIC]: deprecateTransactionsAlerts
      ? ['edit', 'delete']
      : ['edit', 'duplicate', 'delete'],
    [CombinedAlertType.UPTIME]: ['edit', 'delete'],
    [CombinedAlertType.CRONS]: ['edit', 'delete'],
  };

  const actions: MenuItemProps[] = [
    {
      key: 'edit',
      label: t('Edit'),
      to: editLink,
      hidden: !activeActions[rule.type].includes('edit'),
    },
    {
      key: 'duplicate',
      label: t('Duplicate'),
      to: duplicateLink,
      hidden: !activeActions[rule.type].includes('duplicate'),
    },
    {
      key: 'delete',
      label: t('Delete'),
      hidden: !activeActions[rule.type].includes('delete'),
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
    setAssignee(value);
    onOwnerChange(slug, rule, value);
  }

  const unassignedOption = {
    value: '',
    label: (
      <Flex align="center">
        <IconContainer>
          <IconUser />
        </IconContainer>
        <Label>{t('Unassigned')}</Label>
      </Flex>
    ),
    textValue: 'unassigned',
  };

  const project = projects.find(p => p.slug === slug);
  const filteredProjectTeams = (project?.teams ?? []).filter(projTeam => {
    return userTeams.some(team => team.id === projTeam.id);
  });
  const dropdownTeams: Array<SelectOptionOrSection<string>> = filteredProjectTeams
    .map((team, idx) => ({
      value: `team:${team.id}`,
      textValue: team.slug,
      label: (
        <Flex align="center" key={idx}>
          <IconContainer>
            <TeamAvatar team={team} />
          </IconContainer>
          <Label>#{team.slug}</Label>
        </Flex>
      ),
    }))
    .concat(unassignedOption);

  const teamId = assignee?.split(':')[1]!;
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
      <IconUser size="md" variant="primary" />
    </Tooltip>
  );

  const hasUptimeAutoconfigureBadge =
    rule.type === CombinedAlertType.UPTIME &&
    rule.mode === UptimeMonitorMode.AUTO_DETECTED_ACTIVE;

  const titleBadge = hasUptimeAutoconfigureBadge ? (
    <Tooltip
      skipWrapper
      isHoverable
      title={tct(
        'This Uptime Monitoring alert was auto-detected. [learnMore: Learn more].',
        {
          learnMore: (
            <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/" />
          ),
        }
      )}
    >
      <Tag variant="info">{t('Auto Detected')}</Tag>
    </Tooltip>
  ) : null;

  function ruleUrl() {
    switch (rule.type) {
      case CombinedAlertType.METRIC:
        return makeAlertsPathname({
          path: `/rules/details/${rule.id}/`,
          organization,
        });
      case CombinedAlertType.CRONS:
        return makeAlertsPathname({
          path: `/rules/crons/${rule.project.slug}/${rule.id}/details/`,
          organization,
        });
      case CombinedAlertType.UPTIME:
        return makeAlertsPathname({
          path: `/rules/uptime/${rule.projectSlug}/${rule.id}/details/`,
          organization,
        });
      default:
        return makeAlertsPathname({
          path: `/rules/${rule.projects[0]}/${rule.id}/details/`,
          organization,
        });
    }
  }

  return (
    <ErrorBoundary>
      <AlertNameWrapper isIssueAlert={isIssueAlert(rule)}>
        <AlertNameAndStatus>
          <AlertName>
            <Link to={ruleUrl()}>
              {rule.name} {titleBadge}
            </Link>
          </AlertName>
          <AlertIncidentDate>
            <AlertLastIncidentActivationInfo rule={rule} />
          </AlertIncidentDate>
        </AlertNameAndStatus>
      </AlertNameWrapper>
      <Flex align="center">
        <Flex align="center">
          <CombinedAlertBadge rule={rule} />
        </Flex>
        {!isUptime && !isCron && (
          <MarginLeft>
            <AlertRuleStatus rule={rule} />
          </MarginLeft>
        )}
      </Flex>
      <Flex align="center">
        <ProjectBadgeContainer>
          <ProjectBadge
            avatarSize={18}
            project={projectsLoaded && project ? project : {slug}}
          />
        </ProjectBadgeContainer>
      </Flex>

      <Flex align="center">
        {ownerActor ? (
          <ActorAvatar actor={ownerActor} size={24} />
        ) : (
          <Flex justify="end">
            {!projectsLoaded && <StyledLoadingIndicator mini size={16} />}
            {projectsLoaded && (
              <CompactSelect
                size="sm"
                disabled={!hasEditAccess}
                options={dropdownTeams}
                value={assignee}
                searchable
                trigger={triggerProps => (
                  <SelectTrigger.Button
                    {...triggerProps}
                    aria-label={
                      assignee ? `Assigned to #${teamName?.name}` : t('Unassigned')
                    }
                    size="zero"
                    borderless
                  >
                    {avatarElement}
                  </SelectTrigger.Button>
                )}
                searchPlaceholder={t('Filter teams')}
                onChange={handleOwnerChange}
              />
            )}
          </Flex>
        )}
      </Flex>
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

const AlertNameWrapper = styled('div')<{isIssueAlert?: boolean}>`
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  display: flex;
  align-items: center;
  gap: ${space(2)};
  ${p => p.isIssueAlert && `padding: ${space(3)} ${space(2)}; line-height: 2.4;`}
`;

const AlertNameAndStatus = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.35;
`;

const AlertName = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  font-size: ${p => p.theme.fontSize.lg};
`;

const AlertIncidentDate = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;

const ProjectBadgeContainer = styled('div')`
  width: 100%;
`;

const ProjectBadge = styled(IdBadge)`
  flex-shrink: 0;
`;

const ActionsColumn = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${space(1)};
`;

const IconContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${() => SvgIcon.ICON_SIZES.lg};
  flex-shrink: 0;
`;

const Label = styled(TextOverflow)`
  margin-left: ${space(0.75)};
`;

const MarginLeft = styled('div')`
  margin-left: ${space(1)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 0;
  margin-right: ${space(1.5)};
`;

export default RuleListRow;
