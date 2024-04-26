import {Fragment} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import {assignToActor, clearAssignment} from 'sentry/actionCreators/group';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
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
import type {Actor, Group, SuggestedOwnerReason, Team, User} from 'sentry/types';
import {buildTeamId} from 'sentry/utils';
import {useMutation} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
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
) => Promise<void>;

type AssignableTeam = {
  display: string;
  email: string;
  id: string;
  team: Team;
};

type AssignableEntity = {
  assignee: User | AssignableTeam;
  id: string;
  type: Actor['type'];
};

export interface NewAssigneeSelectorDropdownProps {
  group: Group;
  memberList?: User[];
  noDropdown?: boolean;
  onAssign?: OnAssignCallback;
  onClear?: () => void;
  owners?: Omit<SuggestedAssignee, 'assignee'>[];
}

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

  const {mutate, isLoading} = useMutation<
    AssignableEntity,
    RequestError,
    AssignableEntity
  >({
    mutationFn: (newAssignee: AssignableEntity): Promise<AssignableEntity> => {
      // TODO(msun): this functino is only used here, make it better to avoid the jank
      assignToActor({
        id: group.id,
        orgSlug: organization.slug,
        actor: {id: newAssignee.id, type: newAssignee.type},
        assignedBy: 'assignee_selector',
      });
      return Promise.resolve(newAssignee);
    },
    onSuccess: (newAssignee: AssignableEntity) => {
      if (onAssign) {
        const suggestedAssignee = getSuggestedAssignees().find(
          actor => actor.type === newAssignee.type && actor.id === newAssignee.id
        );
        onAssign(newAssignee.type, newAssignee.assignee, suggestedAssignee);
      }
    },
    onError: () => {},
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

    const suggestedOwners = group.owners ?? [];
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
      await handleClear();
      return;
    }
    // See makeMemberOption and makeTeamOption for how the value is formatted
    const type = selectedOption.value.startsWith('USER_') ? 'user' : 'team';
    const assigneeId =
      type === 'user'
        ? selectedOption.value.split('USER_')[1]
        : selectedOption.value.split('TEAM_')[1];

    if (group.assignedTo && assigneeId === group.assignedTo?.id) {
      await handleClear();
      return;
    }

    let assignee: User | AssignableTeam;

    if (type === 'user') {
      assignee = currentMemberList()?.find(member => member.id === assigneeId) as User;
    } else {
      assignee = getAssignableTeams().find(
        assignableTeam => assignableTeam.team.id === assigneeId
      ) as AssignableTeam;
    }

    mutate({assignee: assignee, id: assigneeId, type: type});
  };

  const handleClear = async () => {
    await clearAssignment(group.id, organization.slug, 'assignee_selector');

    if (onClear) {
      onClear();
    }
  };

  const makeMemberOption = (
    userId: string,
    userDisplay: string
  ): SelectOption<string> => {
    const isCurrentUser = userId === sessionUser?.id;

    return {
      label: (
        <IdBadge
          actor={{
            id: userId,
            name: `${userDisplay}${isCurrentUser ? ' (You)' : ''}`,
            type: 'user',
          }}
        />
      ),
      // Jank way to pass assignee type (team or user) into each row
      value: `USER_${userId}`,
      textValue: userDisplay,
    };
  };

  const makeTeamOption = (assignableTeam: AssignableTeam): SelectOption<string> => ({
    label: <IdBadge team={assignableTeam.team} />,
    value: `TEAM_${assignableTeam.team.id}`,
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
        textValue: assignee.name,
      };
    }
    const assignedTeam = assignee.assignee as AssignableTeam;
    return {
      label: (
        <IdBadge
          team={assignedTeam.team}
          description={suggestedReasonTable[assignee.suggestedReason]}
        />
      ),
      value: `TEAM_${assignee.id}`,
      textValue: assignedTeam.team.slug,
    };
  };

  const makeAllOptions = (): SelectOptionOrSection<string>[] => {
    const options: SelectOptionOrSection<string>[] = [];

    let memList = currentMemberList();
    let assignableTeamList = getAssignableTeams();
    let suggestedAssignees = getSuggestedAssignees();

    if (group.assignedTo) {
      if (group.assignedTo.type === 'team') {
        const assignedTeam = assignableTeamList.find(
          assignableTeam => assignableTeam.team.id === group.assignedTo?.id
        );
        if (assignedTeam) {
          options.push({
            value: '_current_assignee',
            label: t('Current Assignee'),
            options: [makeTeamOption(assignedTeam)],
          });
          assignableTeamList = assignableTeamList?.filter(
            team => team.id !== group.assignedTo?.id
          );
          suggestedAssignees = suggestedAssignees?.filter(suggestedAssignee => {
            return suggestedAssignee.id !== group.assignedTo?.id;
          });
        }
      } else {
        const assignedUser = memList?.find(user => user.id === group.assignedTo?.id);
        if (assignedUser) {
          options.push({
            value: '_current_assignee',
            label: t('Current Assignee'),
            options: [
              makeMemberOption(assignedUser.id, assignedUser.name || assignedUser.email),
            ],
          });
          memList = memList?.filter(member => member.id !== group.assignedTo?.id);
          suggestedAssignees = suggestedAssignees?.filter(suggestedAssignee => {
            return suggestedAssignee.id !== group.assignedTo?.id;
          });
        }
      }
    }

    const memberOptions = {
      value: '_members',
      label: t('Everyone Else'),
      options:
        memList?.map(member =>
          makeMemberOption(member.id, member.name || member.email)
        ) ?? [],
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
    const avatarElement = (
      <AssigneeAvatar
        assignedTo={group.assignedTo}
        suggestedActors={getSuggestedAssignees()}
      />
    );
    return (
      <Fragment>
        {isLoading && (
          <LoadingIndicator mini style={{height: '24px', margin: 0, marginRight: 11}} />
        )}
        {!isLoading && !noDropdown && (
          <DropdownButton data-test-id="assignee-selector" {...props}>
            {avatarElement}
            <Chevron direction={isOpen ? 'up' : 'down'} size="small" />
          </DropdownButton>
        )}
        {!isLoading && noDropdown && avatarElement}
      </Fragment>
    );
  };

  const makeFooterInviteButton = () => {
    return (
      <Button
        size="xs"
        aria-label={t('Invite Member')}
        disabled={isLoading}
        onClick={(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
          event.preventDefault();
          openInviteMembersModal({source: 'assignee_selector'});
        }}
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
          group.assignedTo
            ? `${group.assignedTo?.type === 'user' ? 'USER_' : 'TEAM_'}${group.assignedTo.id}`
            : undefined
        }
        onClear={handleClear}
        menuTitle={t('Select Assignee')}
        searchPlaceholder="Search users or teams..."
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
