import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {ActorAvatar} from '@sentry/scraps/avatar';
import {TeamAvatar} from '@sentry/scraps/avatar';
import {MenuComponents} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {openIssueOwnershipRuleModal} from 'sentry/actionCreators/modal';
import type {AssignmentDetails} from 'sentry/components/assigneeBadge';
import type {AssigneeSelectorTrigger} from 'sentry/components/assigneeSelectorDropdown';
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {IconSettings, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Event} from 'sentry/types/event';
import {
  GroupActivityType,
  type Group,
  type GroupActivityAssigned,
} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {buildTeamId} from 'sentry/utils';
import {useProjectMembersQueryOptions} from 'sentry/utils/members/projectMembers';
import {selectUsersFromMembers} from 'sentry/utils/members/shared';
import {useIssueEventOwners} from 'sentry/utils/useIssueEventOwners';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {getOwnerList} from 'sentry/views/issueDetails/header/getOwnerList';

interface GroupHeaderAssigneeSelectorProps {
  event: Event | null;
  group: Group;
  project: Project;
  /**
   * Show the assignee name next to the avatar. Defaults to true.
   */
  showLabel?: boolean;
}

function getCurrentAssignmentActivity(group: Group): GroupActivityAssigned | undefined {
  if (!group.assignedTo) {
    return undefined;
  }

  const latestAssignment = group.activity.find(
    (activity): activity is GroupActivityAssigned =>
      activity.type === GroupActivityType.ASSIGNED
  );

  if (
    latestAssignment?.data.assigneeType !== group.assignedTo.type ||
    latestAssignment.data.assignee !== String(group.assignedTo.id)
  ) {
    return undefined;
  }

  return latestAssignment;
}

function getAssignmentSource(
  activity: GroupActivityAssigned | undefined
): AssignmentDetails['source'] | undefined {
  switch (activity?.data.integration) {
    case 'projectOwnership':
    case 'codeowners':
    case 'suspectCommitter':
    case 'seerSuggested':
      return activity.data.integration;
    default:
      return undefined;
  }
}

function getAssignmentDetails(
  group: Group,
  activity: GroupActivityAssigned | undefined
): AssignmentDetails | undefined {
  const source = getAssignmentSource(activity);

  if (activity?.user) {
    return {
      actorLabel: activity.user.name || activity.user.email || activity.user.username,
      isSelfAssigned:
        group.assignedTo?.type === 'user' &&
        String(group.assignedTo.id) === String(activity.user.id),
      source,
    };
  }

  if (activity?.sentry_app) {
    return {actorLabel: activity.sentry_app.name, source};
  }

  return source ? {source} : undefined;
}

export function GroupHeaderAssigneeSelector({
  group,
  project,
  event,
  showLabel = true,
}: GroupHeaderAssigneeSelectorProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    organization,
    group,
  });
  const assignmentActivity = getCurrentAssignmentActivity(group);
  const assignmentDetails = getAssignmentDetails(group, assignmentActivity);
  const {data: eventOwners} = useIssueEventOwners({
    eventId: event?.id ?? '',
    projectSlug: project.slug,
  });
  const {data: memberList = []} = useQuery({
    ...useProjectMembersQueryOptions([project.id]),
    select: resp => selectUsersFromMembers(resp.json),
  });

  const owners = getOwnerList(
    group.owners ?? [],
    eventOwners,
    group.assignedTo,
    memberList
  );

  return (
    <AssigneeSelector
      group={group}
      owners={event ? owners : undefined}
      assigneeLoading={assigneeLoading}
      handleAssigneeChange={handleAssigneeChange}
      assignmentDetails={assignmentDetails}
      showLabel={showLabel}
      trigger={
        organization.features.includes('issue-assignee-selector-ui')
          ? makeRedesignedAssigneeTrigger({
              assignmentDetails,
              group,
              showLabel,
            })
          : undefined
      }
      useOwnerAssignmentDetails={false}
      additionalMenuFooterItems={
        <MenuComponents.CTAButton
          onClick={() => {
            openIssueOwnershipRuleModal({
              project,
              organization,
              issueId: group.id,
              eventData: event!,
              theme,
            });
          }}
          icon={<IconSettings />}
        >
          {t('Ownership')}
        </MenuComponents.CTAButton>
      }
    />
  );
}

function makeRedesignedAssigneeTrigger({
  assignmentDetails,
  group,
  showLabel,
}: {
  group: Group;
  showLabel: boolean;
  assignmentDetails?: AssignmentDetails;
}): AssigneeSelectorTrigger {
  return function redesignedAssigneeTrigger(props, _isOpen, context) {
    return (
      <RedesignedAssigneeTrigger
        {...props}
        aria-label={t('Modify issue assignee')}
        showChevron={false}
        size="zero"
        variant="transparent"
      >
        <RedesignedAssigneeContent align="center" gap="sm" wrap="nowrap">
          {context.loading ? (
            <AssigneeLoadingIndicator relative size={24} />
          ) : (
            context.renderAvatar({
              assignmentDetails,
              label: showLabel ? (
                <Text ellipsis>
                  {group.assignedTo
                    ? `${group.assignedTo.type === 'team' ? '#' : ''}${
                        group.assignedTo.name
                      }`
                    : t('Unassigned')}
                </Text>
              ) : undefined,
            })
          )}
          {showLabel && context.loading && <Text ellipsis>{t('Loading…')}</Text>}
        </RedesignedAssigneeContent>
      </RedesignedAssigneeTrigger>
    );
  };
}

const RedesignedAssigneeTrigger = styled(OverlayTrigger.Button)`
  align-items: center;
  border: none;
  box-shadow: none;
  display: inline-flex;
  height: 24px;
  justify-content: center;
  line-height: 0;
  padding: 0;

  &:hover {
    background: transparent;
  }
`;

const RedesignedAssigneeContent = styled(Flex)`
  height: 24px;
  /* Optically align the avatar with the embossed priority button surface. */
  transform: translateY(2px);
`;

const AssigneeLoadingIndicator = styled(LoadingIndicator)`
  height: 24px;
  margin: 0;
`;

export function GroupHeaderAssigneeCommandPaletteAction({
  group,
  project,
  event,
}: GroupHeaderAssigneeSelectorProps) {
  const organization = useOrganization();
  const user = useUser();
  const {handleAssigneeChange} = useHandleAssigneeChange({
    organization,
    group,
  });
  const {data: eventOwners} = useIssueEventOwners({
    eventId: event?.id ?? '',
    projectSlug: project.slug,
  });
  const {data: members = []} = useQuery({
    ...useProjectMembersQueryOptions([project.id]),
    select: resp => selectUsersFromMembers(resp.json),
  });

  const owners = getOwnerList(group.owners ?? [], eventOwners, group.assignedTo, members);
  const currentAssigneeIcon = group.assignedTo ? (
    <ActorAvatar actor={group.assignedTo} size={16} hasTooltip={false} />
  ) : (
    <IconUser />
  );
  const assignableUsers = members.filter(member => member.id !== user?.id);
  const assignableTeams = (ProjectsStore.getBySlug(project.slug)?.teams ?? []).sort(
    (a, b) => a.slug.localeCompare(b.slug)
  );
  const assignableActorKeys = new Set([
    ...assignableUsers.map(member => `user:${member.id}`),
    ...assignableTeams.map(team => `team:${team.id}`),
  ]);
  const additionalOwners = owners.filter(
    owner => !assignableActorKeys.has(`${owner.type}:${owner.id}`)
  );
  const currentAssigneeLabel = group.assignedTo
    ? group.assignedTo.type === 'team'
      ? `#${group.assignedTo.name}`
      : group.assignedTo.name
    : null;

  return (
    <CMDKAction
      display={{
        label: t('Assign to'),
        icon: currentAssigneeIcon,
      }}
      limit={4}
    >
      {user && (
        <CMDKAction
          display={{
            label: t('Assign to me'),
            icon: (
              <ActorAvatar
                actor={{id: user.id, name: user.name || user.email, type: 'user'}}
                size={16}
                hasTooltip={false}
              />
            ),
          }}
          onAction={() =>
            handleAssigneeChange({
              assignee: user,
              id: user.id,
              type: 'user',
            })
          }
        />
      )}
      {group.assignedTo && (
        <CMDKAction
          display={{
            label: t('Unassign from %s', currentAssigneeLabel),
            icon: <ActorAvatar actor={group.assignedTo} size={16} hasTooltip={false} />,
          }}
          onAction={() => handleAssigneeChange(null)}
        />
      )}
      {assignableUsers.map(member => (
        <CMDKAction
          key={`member-${member.id}`}
          display={{
            label: member.name || member.email,
            icon: (
              <ActorAvatar
                actor={{id: member.id, name: member.name || member.email, type: 'user'}}
                size={16}
                hasTooltip={false}
              />
            ),
          }}
          onAction={() =>
            handleAssigneeChange({
              assignee: member,
              id: member.id,
              type: 'user',
            })
          }
        />
      ))}
      {assignableTeams.map(team => (
        <CMDKAction
          key={`team-${team.id}`}
          display={{
            label: `#${team.slug}`,
            icon: <TeamAvatar team={team} size={16} hasTooltip={false} />,
          }}
          onAction={() =>
            handleAssigneeChange({
              assignee: {id: buildTeamId(team.id), name: team.slug, type: 'team'},
              id: team.id,
              type: 'team',
            })
          }
        />
      ))}
      {additionalOwners.map(owner => (
        <CMDKAction
          key={`${owner.type}-${owner.id}`}
          display={{
            label: owner.type === 'team' ? `#${owner.name}` : owner.name,
            icon: (
              <ActorAvatar
                actor={{
                  id: owner.id,
                  name: owner.name,
                  type: owner.type,
                }}
                size={16}
                hasTooltip={false}
              />
            ),
          }}
          onAction={() =>
            handleAssigneeChange({
              assignee: owner,
              id: owner.id,
              type: owner.type,
            })
          }
        />
      ))}
    </CMDKAction>
  );
}
