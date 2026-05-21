import {useTheme} from '@emotion/react';
import {useQuery} from '@tanstack/react-query';

import {ActorAvatar} from '@sentry/scraps/avatar';
import {TeamAvatar} from '@sentry/scraps/avatar';
import {MenuComponents} from '@sentry/scraps/compactSelect';

import {openIssueOwnershipRuleModal} from 'sentry/actionCreators/modal';
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import {IconSettings, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {buildTeamId} from 'sentry/utils';
import {useProjectMembersQueryOptions} from 'sentry/utils/members/projectMembers';
import {selectUsersFromMembers} from 'sentry/utils/members/shared';
import {useCommitters} from 'sentry/utils/useCommitters';
import {useIssueEventOwners} from 'sentry/utils/useIssueEventOwners';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {getOwnerList} from 'sentry/views/issueDetails/streamline/header/getOwnerList';

interface GroupHeaderAssigneeSelectorProps {
  event: Event | null;
  group: Group;
  project: Project;
}

export function GroupHeaderAssigneeSelector({
  group,
  project,
  event,
}: GroupHeaderAssigneeSelectorProps) {
  const theme = useTheme();
  const organization = useOrganization();
  const {handleAssigneeChange, assigneeLoading} = useHandleAssigneeChange({
    organization,
    group,
  });
  const {data: eventOwners} = useIssueEventOwners({
    eventId: event?.id ?? '',
    projectSlug: project.slug,
  });
  const {data: committersResponse} = useCommitters({
    eventId: event?.id ?? '',
    projectSlug: project.slug,
    group,
  });

  const owners = getOwnerList(
    committersResponse?.committers ?? [],
    eventOwners,
    group.assignedTo
  );

  return (
    <AssigneeSelector
      group={group}
      owners={owners}
      assigneeLoading={assigneeLoading}
      handleAssigneeChange={handleAssigneeChange}
      showLabel
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
  const {data: committersResponse} = useCommitters({
    eventId: event?.id ?? '',
    projectSlug: project.slug,
    group,
  });
  const {data: members = []} = useQuery({
    ...useProjectMembersQueryOptions([project.id]),
    select: resp => selectUsersFromMembers(resp.json),
  });

  const owners = getOwnerList(
    committersResponse?.committers ?? [],
    eventOwners,
    group.assignedTo
  );
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
