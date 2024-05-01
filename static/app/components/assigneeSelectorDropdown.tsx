import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import {assignToActor, clearAssignment} from 'sentry/actionCreators/group';
import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import SuggestedAvatarStack from 'sentry/components/avatar/suggestedAvatarStack';
import {Button} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import {
  CompactSelect,
  type SelectOption,
  type SelectOptionOrSection,
} from 'sentry/components/compactSelect';
import IdBadge from 'sentry/components/idBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd, IconUser} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
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
  assignee: User | Actor,
  suggestedAssignee?: SuggestedAssignee
) => Promise<void>;

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

type AssignableEntity = {
  assignee: User | Actor;
  id: string;
  type: Actor['type'];
};

export interface AssigneeSelectorDropdownProps {
  group: Group;
  memberList?: User[];
  noDropdown?: boolean;
  onAssign?: OnAssignCallback;
  onClear?: () => void;
  owners?: Omit<SuggestedAssignee, 'assignee'>[];
}

export function AssigneeAvatar({
  assignedTo,
  suggestedActors = [],
}: {
  assignedTo?: Actor | null;
  suggestedActors?: SuggestedAssignee[];
}) {
  const suggestedReasons: Record<SuggestedOwnerReason, React.ReactNode> = {
    suspectCommit: tct('Based on [commit:commit data]', {
      commit: (
        <TooltipSubExternalLink href="https://docs.sentry.io/product/sentry-basics/integrate-frontend/configure-scms/" />
      ),
    }),
    ownershipRule: t('Matching Issue Owners Rule'),
    projectOwnership: t('Matching Issue Owners Rule'),
    codeowners: t('Matching Codeowners Rule'),
  };
  const assignedToSuggestion = suggestedActors.find(actor => actor.id === assignedTo?.id);

  if (assignedTo) {
    return (
      <ActorAvatar
        actor={assignedTo}
        className="avatar"
        size={24}
        tooltip={
          <TooltipWrapper>
            {tct('Assigned to [name]', {
              name: assignedTo.type === 'team' ? `#${assignedTo.name}` : assignedTo.name,
            })}
            {assignedToSuggestion &&
              suggestedReasons[assignedToSuggestion.suggestedReason] && (
                <TooltipSubtext>
                  {suggestedReasons[assignedToSuggestion.suggestedReason]}
                </TooltipSubtext>
              )}
          </TooltipWrapper>
        }
      />
    );
  }

  if (suggestedActors.length > 0) {
    return (
      <SuggestedAvatarStack
        size={26}
        owners={suggestedActors}
        tooltipOptions={{isHoverable: true}}
        tooltip={
          <TooltipWrapper>
            <div>
              {tct('Suggestion: [name]', {
                name:
                  suggestedActors[0].type === 'team'
                    ? `#${suggestedActors[0].name}`
                    : suggestedActors[0].name,
              })}
              {suggestedActors.length > 1 &&
                tn(' + %s other', ' + %s others', suggestedActors.length - 1)}
            </div>
            <TooltipSubtext>
              {suggestedReasons[suggestedActors[0].suggestedReason]}
            </TooltipSubtext>
          </TooltipWrapper>
        }
      />
    );
  }

  return (
    <Tooltip
      isHoverable
      skipWrapper
      title={
        <TooltipWrapper>
          <div>{t('Unassigned')}</div>
          <TooltipSubtext>
            {tct(
              'You can auto-assign issues by adding [issueOwners:Issue Owner rules].',
              {
                issueOwners: (
                  <TooltipSubExternalLink href="https://docs.sentry.io/product/error-monitoring/issue-owners/" />
                ),
              }
            )}
          </TooltipSubtext>
        </TooltipWrapper>
      }
    >
      <StyledIconUser data-test-id="unassigned" size="md" color="gray400" />
    </Tooltip>
  );
}

export default function AssigneeSelectorDropdown({
  group,
  memberList,
  noDropdown = false,
  onAssign,
  onClear,
  owners,
}: AssigneeSelectorDropdownProps) {
  const organization = useOrganization();
  const memberLists = useLegacyStore(MemberListStore);
  const sessionUser = ConfigStore.get('user');

  const [isLoading, setIsLoading] = useState<boolean>(false);

  const {mutate: handleAssigneeChange} = useMutation<
    AssignableEntity | null,
    RequestError,
    AssignableEntity | null
  >({
    mutationFn: async (
      newAssignee: AssignableEntity | null
    ): Promise<AssignableEntity | null> => {
      setIsLoading(true);
      if (newAssignee === null) {
        await clearAssignment(group.id, organization.slug, 'assignee_selector');
        return Promise.resolve(null);
      }

      await assignToActor({
        id: group.id,
        orgSlug: organization.slug,
        actor: {id: newAssignee.id, type: newAssignee.type},
        assignedBy: 'assignee_selector',
      });
      return Promise.resolve(newAssignee);
    },
    onSuccess: async (newAssignee: AssignableEntity | null) => {
      if (!newAssignee && onClear) {
        onClear();
      }
      if (newAssignee && onAssign) {
        const suggestedAssignee = getSuggestedAssignees().find(
          actor => actor.type === newAssignee.type && actor.id === newAssignee.id
        );
        await onAssign(newAssignee.type, newAssignee.assignee, suggestedAssignee);
      }
      setIsLoading(false);
    },
    onError: () => {
      addErrorMessage('Failed to updated assignee');
      setIsLoading(false);
    },
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

  const handleSelect = (selectedOption: SelectOption<string> | null) => {
    // selectedOption is falsey when the option selected is already selected
    if (!selectedOption) {
      handleAssigneeChange(null);
      return;
    }
    // See makeMemberOption and makeTeamOption for how the value is formatted
    const type = selectedOption.value.startsWith('user:') ? 'user' : 'team';
    const assigneeId = selectedOption.value.split(':')[1];

    if (group.assignedTo && assigneeId === group.assignedTo?.id) {
      handleAssigneeChange(null);
      return;
    }

    let assignee: User | Actor;

    if (type === 'user') {
      assignee = currentMemberList()?.find(member => member.id === assigneeId) as User;
    } else {
      const assignedTeam = getAssignableTeams().find(
        assignableTeam => assignableTeam.team.id === assigneeId
      ) as AssignableTeam;
      assignee = {
        id: assignedTeam.id,
        name: assignedTeam.team.slug,
        type: 'team',
      };
    }

    handleAssigneeChange({
      assignee: assignee,
      id: assigneeId,
      type: type,
    } as AssignableEntity);
  };

  const makeMemberOption = (
    userId: string,
    userDisplay: string
  ): SelectOption<string> => {
    const isCurrentUser = userId === sessionUser?.id;

    return {
      label: (
        <IdBadge
          data-test-id="assignee-option"
          actor={{
            id: userId,
            name: `${userDisplay}${isCurrentUser ? ' (You)' : ''}`,
            type: 'user',
          }}
        />
      ),
      // Jank way to pass assignee type (team or user) into each row
      value: `user:${userId}`,
      textValue: userDisplay,
    };
  };

  const makeTeamOption = (assignableTeam: AssignableTeam): SelectOption<string> => ({
    label: <IdBadge data-test-id="assignee-option" team={assignableTeam.team} />,
    value: `team:${assignableTeam.team.id}`,
    textValue: assignableTeam.team.slug,
  });

  const makeSuggestedAssigneeOption = (
    assignee: SuggestedAssignee
  ): SelectOption<string> => {
    if (assignee.type === 'user') {
      return {
        label: (
          <IdBadge
            data-test-id="assignee-option"
            actor={{
              id: assignee.id,
              name: assignee.name,
              type: 'user',
            }}
            description={suggestedReasonTable[assignee.suggestedReason]}
          />
        ),
        value: `user:${assignee.id}`,
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
      value: `team:${assignee.id}`,
      textValue: assignedTeam.team.slug,
    };
  };

  const makeAllOptions = (): SelectOptionOrSection<string>[] => {
    const options: SelectOptionOrSection<string>[] = [];

    let memList = currentMemberList();
    let assignableTeamList = getAssignableTeams();
    let suggestedAssignees = getSuggestedAssignees();

    // If the group is already assigned, extract the assigned
    // user/team from the member-list/assignedTeam-list and add to the top of the menu
    if (group.assignedTo) {
      if (group.assignedTo.type === 'team') {
        const assignedTeam = assignableTeamList.find(
          assignableTeam => assignableTeam.team.id === group.assignedTo?.id
        );
        if (assignedTeam) {
          options.push(makeTeamOption(assignedTeam));
          assignableTeamList = assignableTeamList?.filter(
            assignableTeam => assignableTeam.team.id !== group.assignedTo?.id
          );
          suggestedAssignees = suggestedAssignees?.filter(suggestedAssignee => {
            return suggestedAssignee.id !== group.assignedTo?.id;
          });
        }
      } else {
        const assignedUser = memList?.find(user => user.id === group.assignedTo?.id);
        if (assignedUser) {
          options.push(
            makeMemberOption(assignedUser.id, assignedUser.name || assignedUser.email)
          );
          memList = memList?.filter(member => member.id !== group.assignedTo?.id);
          suggestedAssignees = suggestedAssignees?.filter(suggestedAssignee => {
            return suggestedAssignee.id !== group.assignedTo?.id;
          });
        }
      }
    }

    const memberOptions = {
      value: '_members',
      label: t('Members'),
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

    const suggestedUsers = suggestedAssignees?.filter(
      assignee => assignee.type === 'user'
    );
    const suggestedTeams = suggestedAssignees?.filter(
      assignee => assignee.type === 'team'
    );

    const suggestedOptions = {
      value: '_suggested_assignees',
      label: t('Suggested Assignees'),
      options:
        suggestedUsers
          .map(makeSuggestedAssigneeOption)
          .concat(suggestedTeams?.map(makeSuggestedAssigneeOption)) ?? [],
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
            ? `${group.assignedTo?.type === 'user' ? 'user:' : 'team:'}${group.assignedTo.id}`
            : ''
        }
        onClear={() => handleAssigneeChange(null)}
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

const StyledIconUser = styled(IconUser)`
  /* We need this to center with Avatar */
  margin-right: 2px;
`;

const TooltipWrapper = styled('div')`
  text-align: left;
`;

const TooltipSubExternalLink = styled(ExternalLink)`
  color: ${p => p.theme.subText};
  text-decoration: underline;

  :hover {
    color: ${p => p.theme.subText};
  }
`;

const TooltipSubtext = styled('div')`
  color: ${p => p.theme.subText};
`;
