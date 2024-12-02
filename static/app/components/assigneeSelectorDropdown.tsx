import {Fragment} from 'react';
import styled from '@emotion/styled';
import uniqBy from 'lodash/uniqBy';

import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import ActorAvatar from 'sentry/components/avatar/actorAvatar';
import SuggestedAvatarStack from 'sentry/components/avatar/suggestedAvatarStack';
import {Button} from 'sentry/components/button';
import {
  CompactSelect,
  type SelectOption,
  type SelectOptionOrSection,
} from 'sentry/components/compactSelect';
import DropdownButton from 'sentry/components/dropdownButton';
import {TeamBadge} from 'sentry/components/idBadge/teamBadge';
import UserBadge from 'sentry/components/idBadge/userBadge';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd, IconUser} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {Group, SuggestedOwnerReason} from 'sentry/types/group';
import type {Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {buildTeamId} from 'sentry/utils';
import {useUser} from 'sentry/utils/useUser';

const suggestedReasonTable: Record<SuggestedOwnerReason, string> = {
  suspectCommit: t('Suspect Commit'),
  ownershipRule: t('Ownership Rule'),
  projectOwnership: t('Ownership Rule'),
  // TODO: codeowners may no longer exist
  codeowners: t('Codeowners'),
};

export type AssignableEntity = {
  assignee: User | Actor;
  id: string;
  type: Actor['type'];
  suggestedAssignee?: SuggestedAssignee;
};

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

export interface AssigneeSelectorDropdownProps {
  /**
   * The group (issue) that the assignee selector is for
   * TODO: generalize this for alerts
   */
  group: Group;
  /**
   * If true, there will be a loading indicator in the menu header.
   */
  loading: boolean;
  /**
   * Additional items to render in the menu footer
   */
  additionalMenuFooterItems?: React.ReactNode;
  /**
   * Additional styles to apply to the dropdown
   */
  className?: string;
  /**
   * Optional list of members to populate the dropdown with.
   */
  memberList?: User[];
  /**
   * If true, the chevron to open the dropdown will not be shown
   */
  noDropdown?: boolean;
  /**
   * Callback for when an assignee is selected from the dropdown.
   * The parent component should update the group with the new assignee
   * in this callback.
   */
  onAssign?: (assignedActor: AssignableEntity | null) => void;
  /**
   * Callback for when the assignee is cleared
   */
  onClear?: (clearedAssignee: User | Actor) => void;
  /**
   * Optional list of suggested owners of the group
   */
  owners?: Omit<SuggestedAssignee, 'assignee'>[];
  /**
   * Maximum number of teams/users to display in the dropdown
   */
  sizeLimit?: number;
  /**
   * Optional trigger for the assignee selector. If nothing passed in,
   * the default trigger will be used
   */
  trigger?: (
    props: Omit<React.HTMLAttributes<HTMLElement>, 'children'>,
    isOpen: boolean
  ) => React.ReactNode;
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
  className,
  group,
  loading,
  memberList,
  noDropdown = false,
  onAssign,
  onClear,
  owners,
  sizeLimit = 150,
  trigger,
  additionalMenuFooterItems,
}: AssigneeSelectorDropdownProps) {
  const memberLists = useLegacyStore(MemberListStore);
  const sessionUser = useUser();

  const currentMemberList = memberList ?? memberLists?.members ?? [];

  const getSuggestedAssignees = (): SuggestedAssignee[] => {
    const currAssignableTeams = getAssignableTeams();

    if (owners !== undefined) {
      // Add team or user from store
      return owners
        .map<SuggestedAssignee | null>(owner => {
          if (owner.type === 'user') {
            const member = currentMemberList.find(user => user.id === owner.id);
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
          const member = currentMemberList.find(user => user.id === suggestionId);
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
    // selectedOption is falsey when the option selected is already selected, or when the clear button is clicked
    if (!selectedOption) {
      if (onClear && group.assignedTo) {
        onClear(group.assignedTo);
      }
      return;
    }
    // See makeMemberOption and makeTeamOption for how the value is formatted
    const type = selectedOption.value.startsWith('user:') ? 'user' : 'team';
    const assigneeId = selectedOption.value.split(':')[1];
    let assignee: User | Actor;

    if (type === 'user') {
      assignee = currentMemberList.find(member => member.id === assigneeId) as User;
    } else {
      const assignedTeam = getAssignableTeams().find(
        assignableTeam => assignableTeam.team.id === assigneeId
      ) as AssignableTeam;
      // Convert AssingableTeam to Actor
      assignee = {
        id: assignedTeam.id,
        name: assignedTeam.team.slug,
        type: 'team',
      };
    }
    // Assignee is guaranteed to exist here, but we check to satisfy the type-checker
    if (assignee && onAssign) {
      const suggestedAssignee = getSuggestedAssignees().find(
        actor => actor.type === type && actor.id === assignee.id
      );
      onAssign({
        assignee: assignee,
        id: assigneeId,
        type: type,
        suggestedAssignee: suggestedAssignee,
      });
    }
  };

  const makeMemberOption = (user: User): SelectOption<string> => {
    const isCurrentUser = user.id === sessionUser?.id;
    const userDisplay = user.name || user.email;

    return {
      label: (
        <UserBadge
          data-test-id="assignee-option"
          displayName={`${userDisplay}${isCurrentUser ? ' (You)' : ''}`}
          hideEmail
          user={user}
        />
      ),
      // Jank way to pass assignee type (team or user) into each row
      value: `user:${user.id}`,
      textValue: `${user.name}${user.email}`,
    };
  };

  const makeTeamOption = (assignableTeam: AssignableTeam): SelectOption<string> => ({
    label: <TeamBadge data-test-id="assignee-option" team={assignableTeam.team} />,
    value: `team:${assignableTeam.team.id}`,
    textValue: assignableTeam.team.slug,
  });

  const makeSuggestedAssigneeOption = (
    assignee: SuggestedAssignee
  ): SelectOption<string> => {
    if (assignee.type === 'user') {
      const isCurrentUser = assignee.id === sessionUser?.id;
      return {
        label: (
          <UserBadge
            hideEmail
            data-test-id="assignee-option"
            displayName={`${assignee.name}${isCurrentUser ? ' (You)' : ''}`}
            user={assignee.assignee as User}
            description={
              assignee.suggestedReasonText ??
              suggestedReasonTable[assignee.suggestedReason]
            }
          />
        ),
        value: `user:${assignee.id}`,
        textValue: assignee.name,
      };
    }
    const assignedTeam = assignee.assignee as AssignableTeam;
    return {
      label: (
        <TeamBadge
          data-test-id="assignee-option"
          team={assignedTeam.team}
          description={
            assignee.suggestedReasonText ?? suggestedReasonTable[assignee.suggestedReason]
          }
        />
      ),
      value: `team:${assignee.id}`,
      textValue: assignedTeam.team.slug,
    };
  };

  const makeAllOptions = (): SelectOptionOrSection<string>[] => {
    const options: SelectOptionOrSection<string>[] = [];

    let memList = currentMemberList;
    let assignableTeamList = getAssignableTeams();
    let suggestedAssignees = getSuggestedAssignees();
    let assignedUser: User | undefined;

    // If the group is already assigned, extract the assigned user/team
    // from the member-list/assignedTeam-list and add to the top of the menu
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
        assignedUser = currentMemberList.find(user => user.id === group.assignedTo?.id);
        if (assignedUser) {
          options.push(makeMemberOption(assignedUser));
          memList = memList.filter(member => member.id !== group.assignedTo?.id);
          suggestedAssignees = suggestedAssignees?.filter(suggestedAssignee => {
            return suggestedAssignee.id !== group.assignedTo?.id;
          });
        }
      }
    }

    // Only bubble the current user to the top if they are not already assigned or suggested
    const isUserAssignedOrSuggested =
      assignedUser?.id === sessionUser.id ||
      !!getSuggestedAssignees()?.find(
        suggestedAssignee => suggestedAssignee.id === sessionUser.id
      );
    if (!isUserAssignedOrSuggested) {
      const currentUser = memList.find(user => user.id === sessionUser.id);
      if (currentUser) {
        memList = memList.filter(user => user.id !== sessionUser.id);
        // This can't be sessionUser even though they're the same thing
        // because it would bork the tests
        memList.unshift(currentUser);
      }
    }

    const suggestedUsers = suggestedAssignees?.filter(
      assignee => assignee.type === 'user'
    );
    const suggestedTeams = suggestedAssignees?.filter(
      assignee => assignee.type === 'team'
    );

    // Remove suggested assignees from the member list and team list to avoid duplicates
    memList = memList.filter(
      user => !suggestedUsers.find(suggested => suggested.id === user.id)
    );
    assignableTeamList = assignableTeamList.filter(
      assignableTeam =>
        !suggestedTeams.find(suggested => suggested.id === assignableTeam.team.id)
    );

    const memberOptions = {
      value: '_members',
      label: t('Members'),
      options: memList.map(member => makeMemberOption(member)) ?? [],
    };

    const teamOptions = {
      value: '_teams',
      label: t('Teams'),
      options: assignableTeamList?.map(makeTeamOption) ?? [],
    };

    const suggestedOptions = {
      value: '_suggested_assignees',
      label: t('Suggested'),
      options:
        suggestedUsers
          .map(makeSuggestedAssigneeOption)
          .concat(suggestedTeams?.map(makeSuggestedAssigneeOption)) ?? [],
    };

    options.push(suggestedOptions, memberOptions, teamOptions);

    return options;
  };

  const makeTrigger = (
    props: Omit<React.HTMLAttributes<HTMLElement>, 'children'>,
    isOpen: boolean
  ) => {
    const avatarElement = (
      <AssigneeAvatar
        assignedTo={group.assignedTo}
        suggestedActors={getSuggestedAssignees()}
      />
    );
    return (
      <Fragment>
        {loading && (
          <LoadingIndicator mini style={{height: '24px', margin: 0, marginRight: 11}} />
        )}
        {!loading && !noDropdown && (
          <AssigneeDropdownButton
            borderless
            size="sm"
            isOpen={isOpen}
            data-test-id="assignee-selector"
            {...props}
          >
            {avatarElement}
          </AssigneeDropdownButton>
        )}
        {!loading && noDropdown && avatarElement}
      </Fragment>
    );
  };

  const footerInviteButton = (
    <FooterWrapper>
      <Button
        size="xs"
        aria-label={t('Invite Member')}
        disabled={loading}
        onClick={(event: React.MouseEvent<HTMLAnchorElement, MouseEvent>) => {
          event.preventDefault();
          openInviteMembersModal({source: 'assignee_selector'});
        }}
        icon={<IconAdd isCircled />}
      >
        {t('Invite Member')}
      </Button>
      {additionalMenuFooterItems}
    </FooterWrapper>
  );

  return (
    <AssigneeWrapper>
      <CompactSelect
        searchable
        clearable
        className={className}
        menuWidth={275}
        position="bottom-end"
        disallowEmptySelection={false}
        onClick={e => e.stopPropagation()}
        value={
          group.assignedTo
            ? `${group.assignedTo?.type === 'user' ? 'user:' : 'team:'}${group.assignedTo.id}`
            : ''
        }
        onClear={() => handleSelect(null)}
        menuTitle={t('Assignee')}
        searchPlaceholder="Search users or teams..."
        size="sm"
        onChange={handleSelect}
        options={makeAllOptions()}
        trigger={trigger ?? makeTrigger}
        menuFooter={footerInviteButton}
        sizeLimit={sizeLimit}
        sizeLimitMessage="Use search to find more users and teams..."
      />
    </AssigneeWrapper>
  );
}

const AssigneeWrapper = styled('div')`
  display: flex;
  justify-content: flex-end;
`;

const AssigneeDropdownButton = styled(DropdownButton)`
  z-index: 0;
  padding-left: ${space(0.5)};
  padding-right: ${space(0.5)};
`;

const StyledIconUser = styled(IconUser)`
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

const FooterWrapper = styled('div')`
  display: flex;
  gap: ${space(1)};
  align-items: center;
`;
