import {useEffect} from 'react';
import {useTheme} from '@emotion/react';

import {ActorAvatar} from '@sentry/scraps/avatar';
import {MenuComponents} from '@sentry/scraps/compactSelect';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {openIssueOwnershipRuleModal} from 'sentry/actionCreators/modal';
import {CMDKAction} from 'sentry/components/commandPalette/ui/cmdk';
import {
  AssigneeSelector,
  useHandleAssigneeChange,
} from 'sentry/components/group/assigneeSelector';
import {IconSettings, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import {MemberListStore} from 'sentry/stores/memberListStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {buildTeamId} from 'sentry/utils';
import {useApi} from 'sentry/utils/useApi';
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
  const api = useApi();
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

  useEffect(() => {
    // TODO: We should check if this is already loaded
    fetchOrgMembers(api, organization.slug, [project.id]);
  }, [api, organization, project]);

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
  const api = useApi();
  const organization = useOrganization();
  const user = useUser();
  useLegacyStore(MemberListStore);
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

  useEffect(() => {
    fetchOrgMembers(api, organization.slug, [project.id]);
  }, [api, organization, project]);

  const owners = getOwnerList(
    committersResponse?.committers ?? [],
    eventOwners,
    group.assignedTo
  );
  const currentMemberList = MemberListStore.getAll();
  const currentAssigneeIcon = group.assignedTo ? (
    <ActorAvatar actor={group.assignedTo} size={16} hasTooltip={false} />
  ) : (
    <IconUser />
  );
  const assignableUsers = currentMemberList.filter(member => member.id !== user?.id);
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

  return (
    <CMDKAction
      display={{
        label: t('Assign to'),
        icon: currentAssigneeIcon,
      }}
    >
      <CMDKAction
        display={{
          label: t('Assign to me'),
          icon: user ? (
            <ActorAvatar
              actor={{id: user.id, name: user.name || user.email, type: 'user'}}
              size={16}
              hasTooltip={false}
            />
          ) : (
            <IconUser />
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
            icon: (
              <ActorAvatar
                actor={{id: buildTeamId(team.id), name: team.slug, type: 'team'}}
                size={16}
                hasTooltip={false}
              />
            ),
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
                  id: owner.type === 'team' ? buildTeamId(owner.id) : owner.id,
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
              suggestedAssignee: owner,
            })
          }
        />
      ))}
    </CMDKAction>
  );
}
