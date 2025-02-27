import {useState} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import {openConfirmModal} from 'sentry/components/confirm';
import {Tag} from 'sentry/components/core/badge/tag';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import type {ItemsBeforeFilter} from 'sentry/components/dropdownAutoComplete/types';
import DropdownBubble from 'sentry/components/dropdownBubble';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ErrorBoundary from 'sentry/components/errorBoundary';
import IdBadge from 'sentry/components/idBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconEllipsis, IconUser} from 'sentry/icons';
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

import type {CombinedAlerts} from '../../types';
import {CombinedAlertType} from '../../types';
import {isIssueAlert} from '../../utils';

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
    [CombinedAlertType.METRIC]: ['edit', 'duplicate', 'delete'],
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
    const ownerValue = value && `team:${value}`;
    setAssignee(ownerValue);
    onOwnerChange(slug, rule, ownerValue);
  }

  const unassignedOption: ItemsBeforeFilter[number] = {
    value: '',
    label: (
      <MenuItemWrapper>
        <PaddedIconUser size="lg" />
        <Label>{t('Unassigned')}</Label>
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
    .map<ItemsBeforeFilter[number]>((team, idx) => ({
      value: team.id,
      searchKey: team.slug,
      label: (
        <MenuItemWrapper data-test-id="assignee-option" key={idx}>
          <IconContainer>
            <TeamAvatar team={team} size={24} />
          </IconContainer>
          <Label>#{team.slug}</Label>
        </MenuItemWrapper>
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
      <PaddedIconUser size="lg" color="gray400" />
    </Tooltip>
  );

  const hasUptimeAutoconfigureBadge =
    rule.type === CombinedAlertType.UPTIME &&
    rule.mode === UptimeMonitorMode.AUTO_DETECTED_ACTIVE;

  const titleBadge = hasUptimeAutoconfigureBadge ? (
    <Tag
      type="info"
      tooltipProps={{
        isHoverable: true,
        title: tct(
          'This Uptime Monitoring alert was auto-detected. [learnMore: Learn more].',
          {
            learnMore: (
              <ExternalLink href="https://docs.sentry.io/product/alerts/uptime-monitoring/" />
            ),
          }
        ),
      }}
    >
      {t('Auto Detected')}
    </Tag>
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
      <FlexCenter>
        <FlexCenter>
          <CombinedAlertBadge rule={rule} />
        </FlexCenter>
        {!isUptime && !isCron && (
          <MarginLeft>
            <AlertRuleStatus rule={rule} />
          </MarginLeft>
        )}
      </FlexCenter>
      <FlexCenter>
        <ProjectBadgeContainer>
          <ProjectBadge
            avatarSize={18}
            project={projectsLoaded && project ? project : {slug}}
          />
        </ProjectBadgeContainer>
      </FlexCenter>

      <FlexCenter>
        {ownerActor ? (
          <ActorAvatar actor={ownerActor} size={24} />
        ) : (
          <AssigneeWrapper>
            {!projectsLoaded && <StyledLoadingIndicator mini />}
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

// TODO: see static/app/components/profiling/flex.tsx and utilize the FlexContainer styled component
const FlexCenter = styled('div')`
  display: flex;
  align-items: center;
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

const PaddedIconUser = styled(IconUser)`
  padding: ${space(0.25)};
`;

const IconContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: ${p => p.theme.iconSizes.lg};
  height: ${p => p.theme.iconSizes.lg};
  flex-shrink: 0;
`;

const MenuItemWrapper = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Label = styled(TextOverflow)`
  margin-left: ${space(0.75)};
`;

const MarginLeft = styled('div')`
  margin-left: ${space(1)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  height: 24px;
  margin: 0;
  margin-right: ${space(1.5)};
`;

export default RuleListRow;
