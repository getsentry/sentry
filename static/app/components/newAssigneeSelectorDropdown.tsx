/* eslint-disable @typescript-eslint/no-unused-vars */
import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import {assignToActor, assignToUser, clearAssignment} from 'sentry/actionCreators/group';
import {AssigneeAvatar} from 'sentry/components/assigneeSelector';
import {Chevron} from 'sentry/components/chevron';
import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {
  Actor,
  Group,
  SuggestedOwner,
  SuggestedOwnerReason,
  Team,
  User,
} from 'sentry/types';
import {buildTeamId} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';

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
  // alignMenu?: 'left' | 'right' | undefined;
  // assignedTo?: Actor | null;
  // disabled?: boolean;
  group: Group;
  // id: string;
  memberList: User[];
  noDropdown?: boolean;
  onAssign?: OnAssignCallback;
  onClear?: () => void;
  owners?: Omit<SuggestedAssignee, 'assignee'>[];
}

type AssigneeDropdownState = {
  loading: boolean;
  assignedTo?: Actor | null | undefined;
  suggestedOwners?: SuggestedOwner[] | null;
};

function NewAssigneeSelectorDropdown({
  group,
  memberList,
  onAssign,
  onClear,
  owners,
  noDropdown,
}: NewAssigneeSelectorDropdownProps) {
  // XXX: okay to get rid of 'group' prop here? (PASS GROUP IN, DO NOT USE GROUPSTORE)
  const organization = useOrganization();
  // XXX: DEFAULT TO PROP MEMBERLIST
  const memberLists = useLegacyStore(MemberListStore);

  const [state, setState] = useState<AssigneeDropdownState>(() => {
    const stateAssignedTo = group.assignedTo;
    let assignee;
    if (group.assignedTo?.type === 'team') {
      const teams = ProjectsStore.getBySlug(group?.project.slug)?.teams ?? [];
      assignee = teams.find(team => team.id === group.assignedTo?.id);
    } else if (group.assignedTo?.type === 'user') {
      assignee = memberList?.find(user => user.id === group.assignedTo?.id);
    }

    // XXX: guessing there's ab better way to do these two lines w/ useLegacyStore
    // const stateLoading = GroupStore.hasStatus(id, 'assignTo'); // In the middle of assigning new user

    const stateSuggestedOwners = group?.owners;

    return {
      // loading: stateLoading,
      loading: false, // TODO: FIX DIS
      assignedTo: stateAssignedTo,
      suggestedOwners: stateSuggestedOwners,
    };
  });

  // Previously memberList()
  // XXX: what to call this function?
  const currentMemberList = (): User[] | undefined => {
    return memberList ?? memberLists.members;
  };

  const getSuggestedAssignees = (): SuggestedAssignee[] => {
    const currAssignableTeams = getAssignableTeams();
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

  const getAssignableTeams = (): AssignableTeam[] => {
    const teams = ProjectsStore.getBySlug(group?.project.slug)?.teams ?? [];
    return teams
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(team => ({
        id: buildTeamId(team.id),
        display: `#${team.slug}`,
        email: team.id,
        team,
      }));
  };

  const handleSelect = (selectedOption: SelectOption<string>) => {
    const type = selectedOption.value.startsWith('USER_') ? 'user' : 'team';
    const assigneeId =
      type === 'user'
        ? selectedOption.value.split('USER_')[1]
        : selectedOption.value.split('TEAM_')[1];

    let assignee;
    if (type === 'user') {
      assignee = currentMemberList()?.find(member => member.id === assigneeId);
      handleUserAssign(assignee);
    }

    if (type === 'team') {
      assignee = getAssignableTeams().find(team => team.id === assigneeId);
      handleTeamAssign(assignee);
    }

    if (onAssign) {
      const suggestion = getSuggestedAssignees().find(
        actor => actor.type === type && actor.id === assignee.id
      );
      onAssign(type, assignee, suggestion);
    }
  };

  useEffect(() => {}, []);
  // const handleGroupChange = (itemIds: Set<string>) => {
  //   if (!itemIds.has(id)) {
  //     return;
  //   }
  //   // XXX: bad naming oof (group is now a prop and not state, can't diff with "this")
  //   const recGroup = GroupStore.get(id);
  //   setState({
  //     suggestedOwners: recGroup?.owners,
  //     loading: GroupStore.hasStatus(id, 'assignTo'),
  //   });
  // };

  // Previously assignToTeam
  const handleTeamAssign = async (team: Team) => {
    setState({loading: true});
    await assignToActor({
      actor: {id: team.id, type: 'team'},
      id: group.id,
      orgSlug: organization.slug,
      assignedBy: 'assignee_selector',
    });
    setState({loading: false});
  };
  // Previously assignToUser
  const handleUserAssign = async (user: User | Actor) => {
    setState({loading: true});
    await assignToUser({
      id: group.id,
      orgSlug: organization.slug,
      user,
      assignedBy: 'assignee_selector',
    });
    setState({loading: false});
  };

  const handleClear = () => {
    // clears assignment
    clearAssignment(group.id, organization.slug, 'assignee_selector');
    setState({loading: true});

    if (onClear) {
      onClear();
    }
  };

  const makeMemberOption = (member: User): SelectOption<string> => ({
    label: (
      <IdBadge
        actor={{
          id: member.id,
          name: member.name,
          type: 'user',
        }}
      />
    ),
    value: `USER_${member.id}`,
  });

  const makeTeamOption = (assignableTeam: AssignableTeam): SelectOption<string> => ({
    label: <IdBadge team={assignableTeam.team} />,
    value: `TEAM_${assignableTeam.id}`,
  });

  const makeSuggestedAssigneeOption = (
    assignee: SuggestedAssignee
  ): SelectOption<string> => {
    if (assignee.type === 'user') {
      return {
        label: (
          <IdBadge
            actor={{
              id: assignee.id,
              name: assignee.name,
              type: 'user',
            }}
            description={suggestedReasonTable[assignee.suggestedReason]}
          />
        ),
        value: `USER_${assignee.id}`,
      };
    }

    return {
      label: (
        <IdBadge
          team={(assignee.assignee as AssignableTeam).team}
          description={suggestedReasonTable[assignee.suggestedReason]}
        />
      ),
      value: `TEAM_${assignee.id}`,
    };
  };

  // XXX: 'multiple' prop causing check box to show up
  return (
    // Look for 'hidecheck' prop
    <CompactSelect
      // multiple
      searchable
      clearable
      closeOnSelect
      // defaultValue={state.assignedTo?.type === 'team' ? {
      //   label: <IdBadge team={state.assignedTo.} />,
      // } : '_members'}
      onClear={handleClear}
      menuTitle={t('Select Assignee')}
      size="xs"
      onChange={handleSelect}
      options={[
        {
          value: '_suggested_assignees',
          label: t('Suggested Assignees'),
          options: getSuggestedAssignees()?.map(makeSuggestedAssigneeOption) ?? [],
          hideCheck: true,
        },
        {
          value: '_members',
          label: t('Everyone Else'),
          options: memberList?.map(makeMemberOption) ?? [],
          hideCheck: true,
        },
        {
          value: '_teams',
          label: t('Teams'),
          options: getAssignableTeams().map(makeTeamOption) ?? [],
          hideCheck: true,
        },
      ]}
      trigger={(props, isOpen) => {
        const avatarElement = (
          <AssigneeAvatar
            assignedTo={group?.assignedTo}
            suggestedActors={getSuggestedAssignees()}
          />
        );
        return (
          <Fragment>
            {state.loading && (
              <LoadingIndicator
                mini
                style={{height: '24px', margin: 0, marginRight: 11}}
              />
            )}
            {!state.loading && !noDropdown && (
              <DropdownButton data-test-id="assignee-selector">
                {avatarElement}
                <Chevron direction={isOpen ? 'up' : 'down'} size="small" />
              </DropdownButton>
            )}
            {!state.loading && noDropdown && avatarElement}
          </Fragment>
        );
      }}
    />
  );
}

const DropdownButton = styled('div')`
  display: flex;
  align-items: center;
  font-size: 20px;
  gap: ${space(0.5)};
`;

// const StyledIdBadge = styled(IdBadge)`
//   overflow: hidden;
//   white-space: nowrap;
//   flex-shrink: 1;
// `;

export default NewAssigneeSelectorDropdown;

/**
 * Broad questions:
 */
