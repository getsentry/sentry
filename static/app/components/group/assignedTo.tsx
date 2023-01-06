import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {
  AssigneeSelectorDropdown,
  AssigneeSelectorDropdownProps,
} from 'sentry/components/assigneeSelectorDropdown';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {AutoCompleteRoot} from 'sentry/components/dropdownAutoComplete/menu';
import {
  findMatchedRules,
  Rules,
} from 'sentry/components/group/suggestedOwners/findMatchedRules';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconChevron, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import TeamStore from 'sentry/stores/teamStore';
import space from 'sentry/styles/space';
import type {Actor, Commit, Committer, Group, Project, Release} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import useApi from 'sentry/utils/useApi';
import useCommitters from 'sentry/utils/useCommitters';
import useOrganization from 'sentry/utils/useOrganization';

interface AssignedToProps {
  group: Group;
  project: Project;
  disableDropdown?: boolean;
  event?: Event;
  onAssign?: AssigneeSelectorDropdownProps['onAssign'];
}
type Owner = {
  actor: Actor;
  source: 'codeowners' | 'projectOwnership' | 'suspectCommit';
  commits?: Array<Commit>;
  release?: Release;
  rules?: Array<any> | null;
};
type EventOwners = {
  owners: Array<Actor>;
  rules: Rules;
};

/**
 * Combine the committer and ownership data into a single array, merging
 * users who are both owners based on having commits, and owners matching
 * project ownership rules into one array.
 *
 * ### The return array will include objects of the format:
 *
 * ```ts
 *   actor: <
 *    type,              # Either user or team
 *    SentryTypes.User,  # API expanded user object
 *    {email, id, name}  # Sentry user which is *not* expanded
 *    {email, name}      # Unidentified user (from commits)
 *    {id, name},        # Sentry team (check `type`)
 *   >,
 * ```
 *
 * ### One or both of commits and rules will be present
 *
 * ```ts
 *   commits: [...]  # List of commits made by this owner
 *   rules:   [...]  # Project rules matched for this owner
 * ```
 */
function getOwnerList(
  committers: Committer[],
  eventOwners: EventOwners | null,
  assignedTo: Actor
): Owner[] {
  const owners: Owner[] = committers.map(commiter => ({
    actor: {...commiter.author, type: 'user'},
    commits: commiter.commits,
    source: 'suspectCommit',
  }));

  eventOwners?.owners.forEach(owner => {
    const matchingRule = findMatchedRules(eventOwners?.rules || [], owner);
    const normalizedOwner: Owner = {
      actor: owner,
      rules: matchingRule,
      source: matchingRule?.[0] === 'codeowners' ? 'codeowners' : 'projectOwnership',
    };

    const existingIdx =
      committers.length > 0 && owner.email && owner.type === 'user'
        ? owners.findIndex(o => o.actor.email === owner.email)
        : -1;
    if (existingIdx > -1) {
      owners[existingIdx] = {...normalizedOwner, ...owners[existingIdx]};
      return;
    }
    owners.push(normalizedOwner);
  });

  // Do not display current assignee
  return owners.filter(
    owner => !(owner.actor.type === assignedTo?.type && owner.actor.id === assignedTo?.id)
  );
}

export function getAssignedToDisplayName(group: Group, assignedTo?: Actor) {
  if (assignedTo?.type === 'team') {
    const team = TeamStore.getById(group.assignedTo.id);
    return `#${team?.slug ?? group.assignedTo.name}`;
  }
  if (assignedTo?.type === 'user') {
    const user = MemberListStore.getById(assignedTo.id);
    return user?.name ?? group.assignedTo.name;
  }

  return group.assignedTo?.name ?? t('No-one');
}

function AssignedTo({group, project, event, disableDropdown = false}: AssignedToProps) {
  const organization = useOrganization();
  const api = useApi();
  const [eventOwners, setEventOwners] = useState<EventOwners | null>(null);
  const {data} = useCommitters(
    {
      eventId: event?.id ?? '',
      projectSlug: project.slug,
    },
    {
      notifyOnChangeProps: ['data'],
      enabled: !defined(event?.id) && !defined(group.assignedTo),
    }
  );

  useEffect(() => {
    // TODO: We should check if this is already loaded
    fetchOrgMembers(api, organization.slug, [project.id]);
  }, [api, organization, project]);

  useEffect(() => {
    if (!event) {
      return;
    }

    api
      .requestPromise(
        `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`
      )
      .then(setEventOwners);
  }, [api, event, organization.slug, project.slug]);

  const owners = getOwnerList(data?.committers ?? [], eventOwners, group.assignedTo);
  console.log(owners);

  return (
    <SidebarSection.Wrap data-test-id="assigned-to">
      <SidebarSection.Title>{t('Assigned To')}</SidebarSection.Title>
      <StyledSidebarSectionContent>
        <AssigneeSelectorDropdown
          disabled={disableDropdown}
          id={group.id}
          organization={organization}
        >
          {({loading, assignedTo, isOpen, getActorProps}) => (
            <DropdownButton data-test-id="assignee-selector" {...getActorProps({})}>
              <ActorWrapper>
                {loading ? (
                  <StyledLoadingIndicator mini size={24} />
                ) : assignedTo ? (
                  <ActorAvatar
                    data-test-id="assigned-avatar"
                    actor={assignedTo}
                    hasTooltip={false}
                    size={24}
                  />
                ) : (
                  <IconWrapper>
                    <IconUser size="md" />
                  </IconWrapper>
                )}
                <ActorName>{getAssignedToDisplayName(group, assignedTo)}</ActorName>
              </ActorWrapper>
              {!disableDropdown && (
                <IconChevron
                  data-test-id="assigned-to-chevron-icon"
                  direction={isOpen ? 'up' : 'down'}
                />
              )}
            </DropdownButton>
          )}
        </AssigneeSelectorDropdown>
      </StyledSidebarSectionContent>
    </SidebarSection.Wrap>
  );
}

export default AssignedTo;

const DropdownButton = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(1)};
`;

const ActorWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  max-width: 85%;
  line-height: 1;
`;

const IconWrapper = styled('div')`
  display: flex;
  padding: ${space(0.25)};
`;

const ActorName = styled('div')`
  line-height: 1.2;
  ${p => p.theme.overflowEllipsis}
`;

const StyledSidebarSectionContent = styled(SidebarSection.Content)`
  ${AutoCompleteRoot} {
    display: block;
  }
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  width: 24px;
  height: 24px;
  margin: 0 !important;
`;
