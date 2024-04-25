import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import {assignToActor, assignToUser, clearAssignment} from 'sentry/actionCreators/group';
import {AssigneeAvatar} from 'sentry/components/assigneeSelector';
import type {SuggestedAssignee} from 'sentry/components/assigneeSelectorDropdown';
import {Button} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import {
  CompactSelect,
  type SelectOption,
  type SelectOptionOrSection,
} from 'sentry/components/compactSelect';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
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
  assignee: User | AssignableTeam,
  suggestedAssignee?: SuggestedAssignee
) => void;

type AssignableTeam = {
  display: string;
  email: string;
  id: string;
  team: Team;
};

export interface NewAssigneeSelectorDropdownProps {
  group: Group;
  memberList?: User[];
  noDropdown?: boolean;
  onAssign?: OnAssignCallback;
  onClear?: () => void;
  owners?: Omit<SuggestedAssignee, 'assignee'>[];
}

type AssigneeDropdownState = {
  /** The user or team that the issue is assigned to. '' if no one is assigned */
  assignedTo: AssignableTeam | User | '';
  /** The type of the assignee. Choices are 'user', 'team', or '' if no one is assigned  */
  assignedToType: 'user' | 'team' | '';
  /** Loading state for assignee dropdown */
  loading: boolean;
  /** The issue's suggested owners, if they exist */
  suggestedOwners?: SuggestedOwner[];
};

function NewAssigneeSelectorDropdown({
  group,
  memberList,
  noDropdown = false,
  onAssign,
  onClear,
  owners,
}: NewAssigneeSelectorDropdownProps) {
  const organization = useOrganization();
  const memberLists = useLegacyStore(MemberListStore);
  const sessionUser = ConfigStore.get('user');

  const [state, setState] = useState<AssigneeDropdownState>(() => {
    let assignee: User | AssignableTeam | undefined;

    if (group.assignedTo?.type === 'team') {
      const teams = ProjectsStore.getBySlug(group?.project.slug)?.teams ?? [];
      if (teams) {
        const assignedTeam = teams.find(team => team.id === group.assignedTo?.id);
        assignee = assignedTeam
          ? {
              id: buildTeamId(assignedTeam.id),
              display: `#${assignedTeam.slug}`,
              email: assignedTeam.id,
              team: assignedTeam,
            }
          : undefined;
      }
    } else if (group.assignedTo?.type === 'user') {
      assignee = memberList?.find(user => user.id === group.assignedTo?.id);
    }

    const stateSuggestedOwners = group?.owners;

    return {
      loading: false,
      assignedTo: assignee ?? '',
      assignedToType:
        (group.assignedTo && group.assignedTo.type === 'team' ? 'team' : 'user') ?? '',
      suggestedOwners: stateSuggestedOwners ?? [],
    };
  });

  const currentMemberList = (): User[] | undefined => {
    return memberList ?? memberLists?.members;
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

  const handleSelect = async (selectedOption: SelectOption<string> | null) => {
    // selectedOption is falsey when the option selected is currently selected
    if (!selectedOption) {
      setState({...state, loading: true});
      await handleClear();
      setState({loading: false, assignedTo: '', assignedToType: ''});
      return;
    }
    // See makeMemberOption and makeTeamOption for how the value is formatted
    const type = selectedOption.value.startsWith('USER_') ? 'user' : 'team';
    const assigneeId =
      type === 'user'
        ? selectedOption.value.split('USER_')[1]
        : selectedOption.value.split('TEAM_')[1];

    if (state.assignedTo && assigneeId === state.assignedTo?.id) {
      setState({...state, loading: true});
      await handleClear();
      setState({loading: false, assignedTo: '', assignedToType: ''});
      return;
    }

    if (type === 'user') {
      const assignee = currentMemberList()?.find(member => member.id === assigneeId);
      setState({...state, loading: true});
      await assignToUser({
        id: group.id,
        orgSlug: organization.slug,
        user: assignee as User,
        assignedBy: 'assignee_selector',
      });
      setState({loading: false, assignedTo: assignee as User, assignedToType: 'user'});

      if (onAssign) {
        const suggestion = getSuggestedAssignees().find(
          actor => actor.type === type && actor.id === assignee?.id
        );
        onAssign(type, assignee as User, suggestion);
      }
    } else if (type === 'team') {
      const assignee = getAssignableTeams().find(team => team.id === assigneeId);
      await assignToActor({
        id: group.id,
        orgSlug: organization.slug,
        actor: {id: (assignee as AssignableTeam).id, type: 'team'},
        assignedBy: 'assignee_selector',
      });
      setState({
        loading: false,
        assignedTo: assignee as AssignableTeam,
        assignedToType: 'team',
      });

      if (onAssign) {
        const suggestion = getSuggestedAssignees().find(
          actor => actor.type === type && actor.id === assignee?.id
        );
        onAssign(type, assignee as AssignableTeam, suggestion);
      }
    }
  };

  const handleClear = async () => {
    setState({...state, loading: true});
    await clearAssignment(group.id, organization.slug, 'assignee_selector');
    setState({loading: false, assignedTo: '', assignedToType: ''});

    if (onClear) {
      onClear();
    }
  };

  const makeMemberOption = (member: User): SelectOption<string> => {
    const isCurrentUser = member.id === sessionUser?.id;

    return {
      label: (
        <IdBadge
          actor={{
            id: member.id,
            name: `${member.name || member.email}${isCurrentUser ? ' (You)' : ''}`,
            type: 'user',
          }}
        />
      ),
      // Jank way to pass assignee type (team or user) into each row
      value: `USER_${member.id}`,
      textValue: member.name || member.email,
    };
  };

  const makeTeamOption = (assignableTeam: AssignableTeam): SelectOption<string> => ({
    label: <IdBadge team={assignableTeam.team} />,
    value: `TEAM_${assignableTeam.id}`,
    textValue: assignableTeam.team.slug,
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

  const makeAllOptions = (): SelectOptionOrSection<string>[] => {
    const options: SelectOptionOrSection<string>[] = [];

    let memList = currentMemberList();
    let assignableTeamList = getAssignableTeams();
    const suggestedAssignees = getSuggestedAssignees();

    if (state.assignedTo) {
      if (state.assignedToType === 'team') {
        options.unshift({
          value: '_current_assignee',
          label: t('Current Assignee'),
          options: [makeTeamOption(state.assignedTo as AssignableTeam)],
        });
        assignableTeamList = assignableTeamList?.filter(
          team => team.id !== (state.assignedTo as AssignableTeam).id
        );
      } else {
        options.unshift({
          value: '_current_assignee',
          label: t('Current Assignee'),
          options: [makeMemberOption(state.assignedTo as User)],
        });
        memList = memList?.filter(member => member.id !== (state.assignedTo as User).id);
      }
    }

    const memberOptions = {
      value: '_members',
      label: t('Everyone Else'),
      options: memList?.map(makeMemberOption) ?? [],
    };

    const teamOptions = {
      value: '_teams',
      label: t('Teams'),
      options: assignableTeamList?.map(makeTeamOption) ?? [],
    };

    const suggestedOptions = {
      value: '_suggested_assignees',
      label: t('Suggested Assignees'),
      options: suggestedAssignees?.map(makeSuggestedAssigneeOption) ?? [],
    };

    options.push(suggestedOptions, memberOptions, teamOptions);

    return options;
  };

  const makeTrigger = (props, isOpen) => {
    if (state.assignedTo) {
      state.assignedTo;
    }
    const avatarElement = (
      <AssigneeAvatar
        assignedTo={
          (state.assignedTo &&
            state.assignedToType && {
              id: state.assignedTo.id,
              name:
                state.assignedToType === 'team'
                  ? `#${(state.assignedTo as AssignableTeam).display}`
                  : (state.assignedTo as User).name,
              type: state.assignedToType,
              email: state.assignedTo.email,
            }) as Actor
        }
        suggestedActors={getSuggestedAssignees()}
      />
    );
    return (
      <Fragment>
        {state.loading && (
          <LoadingIndicator mini style={{height: '24px', margin: 0, marginRight: 11}} />
        )}
        {!state.loading && !noDropdown && (
          <DropdownButton data-test-id="assignee-selector" {...props}>
            {avatarElement}
            <Chevron direction={isOpen ? 'up' : 'down'} size="small" />
          </DropdownButton>
        )}
        {!state.loading && noDropdown && avatarElement}
      </Fragment>
    );
  };

  // Haven't implemented the functionality for this button yet, just for visual purposes currently
  const makeFooterInviteButton = () => {
    return (
      <Button
        size="xs"
        aria-label={t('Invite Member')}
        // to={`/organizations/${organization.slug}/projects/new/`}
        icon={<IconAdd isCircled />}
      >
        {t('Invite Member')}
      </Button>
    );
  };

  return (
    <AssigneeWrapper>
      <CompactSelect
        searchable
        clearable
        disallowEmptySelection={false}
        onClick={e => e.stopPropagation()}
        value={
          state.assignedTo &&
          `${state.assignedToType ? 'USER_' : 'TEAM_'}${state.assignedTo.id}`
        }
        onClear={handleClear}
        menuTitle={t('Select Assignee')}
        size="sm"
        onChange={handleSelect}
        options={makeAllOptions()}
        trigger={makeTrigger}
        menuFooter={makeFooterInviteButton()}
      />
    </AssigneeWrapper>
  );
}

const AssigneeWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;

  /* manually align menu underneath dropdown caret */
`;

const DropdownButton = styled('button')`
  appearance: none;
  border: 0;
  background: transparent;
  display: flex;
  align-items: center;
  font-size: 20px;
  gap: ${space(0.5)};
`;

export default NewAssigneeSelectorDropdown;
