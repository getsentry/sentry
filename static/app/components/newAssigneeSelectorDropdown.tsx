/* eslint-disable @typescript-eslint/no-unused-vars */
import {useState} from 'react';
import uniqBy from 'lodash/uniqBy';

import {clearAssignment} from 'sentry/actionCreators/group';
import {CompactSelect} from 'sentry/components/compactSelect';
import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {
  Actor,
  Group,
  Organization,
  SuggestedOwner,
  SuggestedOwnerReason,
  Team,
  User,
} from 'sentry/types';
import {buildTeamId} from 'sentry/utils';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';

const suggestedReasonTable: Record<SuggestedOwnerReason, string> = {
  suspectCommit: t('Suspect Commit'),
  ownershipRule: t('Ownership Rule'),
  projectOwnership: t('Ownership Rule'),
  // TODO: codeowners may no longer exist
  codeowners: t('Codeowners'),
};

export type OnAssignCallback = (
  type: Actor['type'],
  assignee: User | Actor,
  suggestedAssignee?: SuggestedAssignee
) => void;

export type SuggestedAssignee = Actor & {
  assignee: AssignableTeam | User;
  suggestedReason: SuggestedOwnerReason;
  suggestedReasonText?: React.ReactNode;
};

type AssignableTeam = {
  display: string;
  email: string;
  id: string;
  team: Team;
};

export interface NewAssigneeSelectorDropdownProps {
  // children: (props: RenderProps) => React.ReactNode;
  id: string;
  organization: Organization;
  // alignMenu?: 'left' | 'right' | undefined;
  // assignedTo?: Actor | null;
  // disabled?: boolean;
  group?: Group | FeedbackIssue;
  memberList?: User[];
  // onAssign?: OnAssignCallback;
  onClear?: () => void;
  owners?: Omit<SuggestedAssignee, 'assignee'>[];
}

type AssigneeDropdownState = {
  loading: boolean;
  // How to handle state?
  assignedTo?: Actor | null | undefined;
  memberList?: User[];
  suggestedOwners?: SuggestedOwner[] | null;
};

function NewAssigneeSelectorDropdown({
  id,
  organization,
  group,
  memberList,
  onClear,
  owners,
}: NewAssigneeSelectorDropdownProps) {
  const [state, setState] = useState<AssigneeDropdownState>(() => {
    const stateGroup = GroupStore.get(id);
    const stateAssignedTo = stateGroup?.assignedTo;
    const stateLoading = GroupStore.hasStatus(id, 'assignTo');
    const stateMemberList = MemberListStore.state.loading
      ? undefined
      : MemberListStore.getAll();
    const stateSuggestedOwners = stateGroup?.owners;

    return {
      assignedTo: stateAssignedTo,
      loading: stateLoading,
      memberList: stateMemberList,
      suggestedOwners: stateSuggestedOwners,
    };
  });

  // Previously memberList()
  const currentMemberList = (): User[] | undefined => {
    return memberList ?? state.memberList;
  };

  const getSuggestedAssignees = (): SuggestedAssignee[] => {
    const currAssignableTeams = assignableTeams();
    const currMembers = currentMemberList() ?? [];

    if (owners !== undefined) {
      // Add team or user from store
      return owners
        .map<SuggestedAssignee | null>(owner => {
          if (owner.type === 'user') {
            const member = currMembers.find(user => user.id === owner.id);
            if (member) {
              return {
                ...owner,
                assignee: member,
              };
            }
          }
          if (owner.type === 'team') {
            const matchingTeam = currAssignableTeams.find(
              assignableTeam => assignableTeam.team.id === owner.id
            );
            if (matchingTeam) {
              return {
                ...owner,
                assignee: matchingTeam,
              };
            }
          }

          return null;
        })
        .filter((owner): owner is SuggestedAssignee => !!owner);
    }

    const {suggestedOwners} = state;
    if (!suggestedOwners) {
      return [];
    }

    const uniqueSuggestions = uniqBy(suggestedOwners, owner => owner.owner);
    return uniqueSuggestions
      .map<SuggestedAssignee | null>(suggestion => {
        // converts a backend suggested owner to a suggested assignee
        const [suggestionType, suggestionId] = suggestion.owner.split(':');
        const suggestedReasonText = suggestedReasonTable[suggestion.type];
        if (suggestionType === 'user') {
          const member = currMembers.find(user => user.id === suggestionId);
          if (member) {
            return {
              id: suggestionId,
              type: 'user',
              name: member.name,
              suggestedReason: suggestion.type,
              suggestedReasonText,
              assignee: member,
            };
          }
        } else if (suggestionType === 'team') {
          const matchingTeam = currAssignableTeams.find(
            assignableTeam => assignableTeam.id === suggestion.owner
          );
          if (matchingTeam) {
            return {
              id: suggestionId,
              type: 'team',
              name: matchingTeam.team.name,
              suggestedReason: suggestion.type,
              suggestedReasonText,
              assignee: matchingTeam,
            };
          }
        }

        return null;
      })
      .filter((owner): owner is SuggestedAssignee => !!owner);
  };

  const assignableTeams = (): AssignableTeam[] => {
    const currGroup = GroupStore.get(id) ?? group;
    if (!currGroup) {
      return [];
    }

    const teams = ProjectsStore.getBySlug(currGroup.project.slug)?.teams ?? [];
    return teams
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(team => ({
        id: buildTeamId(team.id),
        display: `#${team.slug}`,
        email: team.id,
        team,
      }));
  };

  const clearAssignTo = (e: React.MouseEvent<HTMLDivElement>) => {
    // clears assignment
    clearAssignment(id, organization.slug, 'assignee_selector');
    setState({loading: true});

    if (onClear) {
      onClear();
    }
    e.stopPropagation();
  };

  const makeMemberOption = (member: User) => ({
    label: (
      <IdBadge
        actor={{
          id: member.id,
          name: member.name,
          type: 'user',
        }}
        // avatarSize={18}
      />
    ),
    value: member.id,
  });

  return (
    <CompactSelect
      multiple
      searchable
      loading
      closeOnSelect
      menuTitle={t('Select Assignee')}
      options={memberList?.map(makeMemberOption) ?? []}
    />
  );
}

// const StyledIdBadge = styled(IdBadge)`
//   overflow: hidden;
//   white-space: nowrap;
//   flex-shrink: 1;
// `;

export default NewAssigneeSelectorDropdown;
