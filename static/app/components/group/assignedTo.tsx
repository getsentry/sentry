import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {assignToActor, clearAssignment} from 'sentry/actionCreators/group';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {fetchOrgMembers} from 'sentry/actionCreators/members';
import {openIssueOwnershipRuleModal} from 'sentry/actionCreators/modal';
import Access from 'sentry/components/acl/access';
import AssigneeSelectorDropdown, {
  type AssignableEntity,
} from 'sentry/components/assigneeSelectorDropdown';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import {Button} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import type {
  OnAssignCallback,
  SuggestedAssignee,
} from 'sentry/components/deprecatedAssigneeSelectorDropdown';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import * as SidebarSection from 'sentry/components/sidebarSection';
import {IconSettings, IconUser} from 'sentry/icons';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import TeamStore from 'sentry/stores/teamStore';
import {space} from 'sentry/styles/space';
import type {Actor, Commit, Committer, Group, Project} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import useCommitters from 'sentry/utils/useCommitters';
import useOrganization from 'sentry/utils/useOrganization';

// TODO(ts): add the correct type
type Rules = Array<any> | null;

/**
 * Given a list of rule objects returned from the API, locate the matching
 * rules for a specific owner.
 */
function findMatchedRules(rules: Rules, owner: Actor) {
  if (!rules) {
    return undefined;
  }

  const matchOwner = (actorType: Actor['type'], key: string) =>
    (actorType === 'user' && key === owner.email) ||
    (actorType === 'team' && key === owner.name);

  const actorHasOwner = ([actorType, key]) =>
    actorType === owner.type && matchOwner(actorType, key);

  return rules
    .filter(([_, ruleActors]) => ruleActors.find(actorHasOwner))
    .map(([rule]) => rule);
}

interface AssignedToProps {
  group: Group;
  project: Project;
  disableDropdown?: boolean;
  event?: Event;
  onAssign?: OnAssignCallback;
}
type IssueOwner = {
  actor: Actor;
  source: 'codeowners' | 'projectOwnership' | 'suspectCommit';
  commits?: Commit[];
  rules?: Array<[string, string]> | null;
};
export type EventOwners = {
  owners: Actor[];
  rules: Rules;
};

function getSuggestedReason(owner: IssueOwner) {
  if (owner.commits) {
    return t('Suspect commit author');
  }

  if (owner.rules?.length) {
    const firstRule = owner.rules[0];
    return t('Owner of %s', firstRule.join(':'));
  }

  return '';
}

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
 *    {User},            # API expanded user object
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
export function getOwnerList(
  committers: Committer[],
  eventOwners: EventOwners | null,
  assignedTo: Actor | null
): Omit<SuggestedAssignee, 'assignee'>[] {
  const owners: IssueOwner[] = committers.map(commiter => ({
    actor: {...commiter.author, type: 'user'},
    commits: commiter.commits,
    source: 'suspectCommit',
  }));

  eventOwners?.owners.forEach(owner => {
    const matchingRule = findMatchedRules(eventOwners?.rules || [], owner);
    const normalizedOwner: IssueOwner = {
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
  const filteredOwners = owners.filter(
    owner => !(owner.actor.type === assignedTo?.type && owner.actor.id === assignedTo?.id)
  );

  // Convert to suggested assignee format
  return filteredOwners.map<Omit<SuggestedAssignee, 'assignee'>>(owner => ({
    ...owner.actor,
    suggestedReasonText: getSuggestedReason(owner),
    suggestedReason: owner.source,
  }));
}

export function getAssignedToDisplayName(group: Group | FeedbackIssue) {
  if (group.assignedTo?.type === 'team') {
    const team = TeamStore.getById(group.assignedTo.id);
    return `#${team?.slug ?? group.assignedTo.name}`;
  }
  if (group.assignedTo?.type === 'user') {
    const user = MemberListStore.getById(group.assignedTo.id);
    return user?.name ?? group.assignedTo.name;
  }

  return group.assignedTo?.name;
}

function AssignedTo({
  group,
  project,
  event,
  onAssign,
  disableDropdown = false,
}: AssignedToProps) {
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
      enabled: defined(event?.id),
    }
  );

  const {mutate: handleAssigneeChange, isLoading: assigneeLoading} = useMutation<
    AssignableEntity | null,
    RequestError,
    AssignableEntity | null
  >({
    mutationFn: async (
      newAssignee: AssignableEntity | null
    ): Promise<AssignableEntity | null> => {
      if (newAssignee) {
        await assignToActor({
          id: group.id,
          orgSlug: organization.slug,
          actor: {id: newAssignee.id, type: newAssignee.type},
          assignedBy: 'assignee_selector',
        });
        return Promise.resolve(newAssignee);
      }

      await clearAssignment(group.id, organization.slug, 'assignee_selector');
      return Promise.resolve(null);
    },
    onSuccess: (newAssignee: AssignableEntity | null) => {
      if (onAssign && newAssignee) {
        onAssign(newAssignee.type, newAssignee.assignee, newAssignee.suggestedAssignee);
      }
    },
    onError: () => {
      addErrorMessage('Failed to update assignee');
    },
  });

  useEffect(() => {
    // TODO: We should check if this is already loaded
    fetchOrgMembers(api, organization.slug, [project.id]);
  }, [api, organization, project]);

  useEffect(() => {
    if (!event) {
      return () => {};
    }

    let unmounted = false;

    api
      .requestPromise(
        `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`
      )
      .then(response => {
        if (unmounted) {
          return;
        }

        setEventOwners(response);
      });

    return () => {
      unmounted = true;
    };
  }, [api, event, organization, project.slug]);

  const owners = getOwnerList(data?.committers ?? [], eventOwners, group.assignedTo);

  const makeTrigger = (props: any, isOpen: boolean) => {
    return (
      <DropdownButton data-test-id="assignee-selector" {...props}>
        <ActorWrapper>
          {assigneeLoading ? (
            <StyledLoadingIndicator mini size={24} />
          ) : group.assignedTo ? (
            <ActorAvatar
              data-test-id="assigned-avatar"
              actor={group.assignedTo}
              hasTooltip={false}
              size={24}
            />
          ) : (
            <IconWrapper>
              <IconUser size="md" />
            </IconWrapper>
          )}
          <ActorName>{getAssignedToDisplayName(group) ?? t('No one')}</ActorName>
        </ActorWrapper>
        {!disableDropdown && (
          <Chevron
            data-test-id="assigned-to-chevron-icon"
            size="large"
            direction={isOpen ? 'up' : 'down'}
          />
        )}
      </DropdownButton>
    );
  };

  return (
    <SidebarSection.Wrap data-test-id="assigned-to">
      <StyledSidebarTitle>
        {t('Assigned To')}
        <Access access={['project:read']}>
          <GuideAnchor target="issue_sidebar_owners" position="bottom">
            <Button
              onClick={() => {
                openIssueOwnershipRuleModal({
                  project,
                  organization,
                  issueId: group.id,
                  eventData: event!,
                });
              }}
              aria-label={t('Create Ownership Rule')}
              icon={<IconSettings />}
              borderless
              size="xs"
            />
          </GuideAnchor>
        </Access>
      </StyledSidebarTitle>
      <SidebarSection.Content>
        <StyledAssigneeSelectorDropdown
          group={group}
          owners={owners}
          loading={assigneeLoading}
          onAssign={handleAssigneeChange}
          onClear={() => handleAssigneeChange(null)}
          trigger={makeTrigger}
        />
      </SidebarSection.Content>
    </SidebarSection.Wrap>
  );
}

export default AssignedTo;

const StyledAssigneeSelectorDropdown = styled(AssigneeSelectorDropdown)`
  width: 100%;
`;

const DropdownButton = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  justify-content: space-between;
  width: 100%;
  cursor: pointer;
`;

const ActorWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  max-width: 100%;
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

const StyledSidebarTitle = styled(SidebarSection.Title)`
  justify-content: space-between;
  margin-right: -${space(1)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  width: 24px;
  height: 24px;
  margin: 0 !important;
`;
