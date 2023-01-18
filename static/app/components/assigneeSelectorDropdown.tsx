import {Component} from 'react';
import styled from '@emotion/styled';

import {assignToActor, assignToUser, clearAssignment} from 'sentry/actionCreators/group';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import type {GetActorPropsFn} from 'sentry/components/deprecatedDropdownMenu';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import {ItemsBeforeFilter} from 'sentry/components/dropdownAutoComplete/types';
import Highlight from 'sentry/components/highlight';
import Link from 'sentry/components/links/link';
import TextOverflow from 'sentry/components/textOverflow';
import {IconAdd, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import space from 'sentry/styles/space';
import type {
  Actor,
  Group,
  Organization,
  SuggestedOwnerReason,
  Team,
  User,
} from 'sentry/types';
import {buildTeamId, buildUserId} from 'sentry/utils';

export type SuggestedAssignee = Actor & {
  assignee: AssignableTeam | User;
  suggestedReason: string;
};

type AssignableTeam = {
  display: string;
  email: string;
  id: string;
  team: Team;
};

type RenderProps = {
  getActorProps: GetActorPropsFn;
  isOpen: boolean;
  loading: boolean;
  suggestedAssignees: SuggestedAssignee[];
};

export interface AssigneeSelectorDropdownProps {
  children: (props: RenderProps) => React.ReactNode;
  group: Group;
  organization: Organization;
  disabled?: boolean;
  memberList?: User[];
  onAssign?: (
    type: Actor['type'],
    assignee: User | Actor,
    suggestedAssignee?: SuggestedAssignee
  ) => void;
  owners?: Omit<SuggestedAssignee, 'assignee'>[];
}

type State = {
  memberList?: User[];
};

export class AssigneeSelectorDropdown extends Component<
  AssigneeSelectorDropdownProps,
  State
> {
  state = this.getInitialState();

  getInitialState() {
    const memberList = MemberListStore.loaded ? MemberListStore.getAll() : undefined;

    return {
      memberList,
      loading: false,
    };
  }

  componentWillUnmount() {
    this.unlisteners.forEach(unlistener => unlistener?.());
  }

  unlisteners = [
    MemberListStore.listen((users: User[]) => {
      this.handleMemberListUpdate(users);
    }, undefined),
  ];

  hasStreamlineTargeting() {
    return this.props.organization.features.includes('streamline-targeting-context');
  }

  handleMemberListUpdate = (members: User[]) => {
    if (members === this.state.memberList) {
      return;
    }

    this.setState({memberList: members});
  };

  memberList(): User[] | undefined {
    return this.props.memberList ?? this.state.memberList;
  }

  assignableTeams(): AssignableTeam[] {
    const {group} = this.props;

    const teams = ProjectsStore.getBySlug(group.project.slug)?.teams ?? [];
    return teams
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(team => ({
        id: buildTeamId(team.id),
        display: `#${team.slug}`,
        email: team.id,
        team,
      }));
  }

  assignToUser(user: User | Actor) {
    assignToUser({id: this.props.group.id, user, assignedBy: 'assignee_selector'});
  }

  assignToTeam(team: Team) {
    assignToActor({
      actor: {id: team.id, type: 'team'},
      id: this.props.group.id,
      assignedBy: 'assignee_selector',
    });
  }

  handleAssign: React.ComponentProps<typeof DropdownAutoComplete>['onSelect'] = (
    {value: {type, assignee}},
    _state,
    e
  ) => {
    if (type === 'member') {
      this.assignToUser(assignee);
    }

    if (type === 'team') {
      this.assignToTeam(assignee);
    }

    e?.stopPropagation();

    const {onAssign} = this.props;
    if (onAssign) {
      const suggestionType = type === 'member' ? 'user' : type;
      const suggestion = this.getSuggestedAssignees().find(
        actor => actor.type === suggestionType && actor.id === assignee.id
      );
      onAssign?.(type, assignee, suggestion);
    }
  };

  clearAssignTo = (e: React.MouseEvent<HTMLDivElement>) => {
    // clears assignment
    clearAssignment(this.props.group.id, 'assignee_selector');
    e.stopPropagation();
  };

  renderMemberNode(member: User, suggestedReason?: string): ItemsBeforeFilter[0] {
    const sessionUser = ConfigStore.get('user');

    const handleSelect = () => this.assignToUser(member);

    return {
      value: {type: 'member', assignee: member},
      searchKey: `${member.email} ${member.name}`,
      label: ({inputValue}) => (
        <MenuItemWrapper
          data-test-id="assignee-option"
          key={buildUserId(member.id)}
          onSelect={handleSelect}
        >
          <IconContainer>
            <UserAvatar user={member} size={24} />
          </IconContainer>
          {this.hasStreamlineTargeting() ? (
            <div>
              <AssigneeLabel>
                <Highlight text={inputValue}>
                  {sessionUser.id === member.id
                    ? `${member.name || member.email} ${t('(You)')}`
                    : member.name || member.email}
                </Highlight>
              </AssigneeLabel>
              <AssigneeLabel>
                {suggestedReason && <SuggestedReason>{suggestedReason}</SuggestedReason>}
              </AssigneeLabel>
            </div>
          ) : (
            <Label>
              <Highlight text={inputValue}>
                {sessionUser.id === member.id
                  ? `${member.name || member.email} ${t('(You)')}`
                  : member.name || member.email}
              </Highlight>
              {suggestedReason && <SuggestedReason> ({suggestedReason})</SuggestedReason>}
            </Label>
          )}
        </MenuItemWrapper>
      ),
    };
  }

  renderNewMemberNodes(): ItemsBeforeFilter {
    const members = putSessionUserFirst(this.memberList());
    return members.map(member => this.renderMemberNode(member));
  }

  renderTeamNode(
    assignableTeam: AssignableTeam,
    suggestedReason?: string
  ): ItemsBeforeFilter[0] {
    const {id, display, team} = assignableTeam;

    const handleSelect = () => this.assignToTeam(team);

    return {
      value: {type: 'team', assignee: team},
      searchKey: team.slug,
      label: ({inputValue}) => (
        <MenuItemWrapper data-test-id="assignee-option" key={id} onSelect={handleSelect}>
          <IconContainer>
            <TeamAvatar team={team} size={24} />
          </IconContainer>
          {this.hasStreamlineTargeting() ? (
            <div>
              <AssigneeLabel>
                <Highlight text={inputValue}>{display}</Highlight>
              </AssigneeLabel>
              <AssigneeLabel>
                {suggestedReason && <SuggestedReason>{suggestedReason}</SuggestedReason>}
              </AssigneeLabel>
            </div>
          ) : (
            <Label>
              <Highlight text={inputValue}>{display}</Highlight>
              {suggestedReason && <SuggestedReason> ({suggestedReason})</SuggestedReason>}
            </Label>
          )}
        </MenuItemWrapper>
      ),
    };
  }

  renderSuggestedAssigneeNodes(): React.ComponentProps<
    typeof DropdownAutoComplete
  >['items'] {
    const {assignedTo} = this.props.group;
    const textReason: Record<SuggestedOwnerReason, string> = {
      suspectCommit: t('Suspect Commit'),
      releaseCommit: t('Suspect Release'),
      ownershipRule: t('Ownership Rule'),
      codeowners: t('Codeowners'),
    };
    // filter out suggested assignees if a suggestion is already selected
    return this.getSuggestedAssignees()
      .filter(({type, id}) => !(type === assignedTo?.type && id === assignedTo?.id))
      .filter(({type}) => type === 'user' || type === 'team')
      .map(({type, suggestedReason, assignee}) => {
        const reason = textReason[suggestedReason] ?? suggestedReason;
        if (type === 'user') {
          return this.renderMemberNode(assignee as User, reason);
        }

        return this.renderTeamNode(assignee as AssignableTeam, reason);
      });
  }

  renderDropdownGroupLabel(label: string) {
    return <GroupHeader>{label}</GroupHeader>;
  }

  renderNewDropdownItems(): ItemsBeforeFilter {
    const teams = this.assignableTeams().map(team => this.renderTeamNode(team));
    const members = this.renderNewMemberNodes();
    const sessionUser = ConfigStore.get('user');
    const suggestedAssignees = this.renderSuggestedAssigneeNodes() ?? [];

    const filteredSessionUser: ItemsBeforeFilter = members.filter(
      member => member.value.assignee.id === sessionUser.id
    );
    // filter out session user from Suggested
    const filteredSuggestedAssignees: ItemsBeforeFilter = suggestedAssignees.filter(
      assignee => {
        return assignee.value.type === 'member'
          ? assignee.value.assignee.id !== sessionUser.id
          : assignee;
      }
    );

    const assigneeIds = new Set(
      filteredSuggestedAssignees.map(
        assignee => `${assignee.value.type}:${assignee.value.assignee.id}`
      )
    );
    // filter out duplicates of Team/Member if also a Suggested Assignee
    const filteredTeams: ItemsBeforeFilter = teams.filter(team => {
      return !assigneeIds.has(`${team.value.type}:${team.value.assignee.id}`);
    });
    const filteredMembers: ItemsBeforeFilter = members.filter(member => {
      return (
        !assigneeIds.has(`${member.value.type}:${member.value.assignee.id}`) &&
        member.value.assignee.id !== sessionUser.id
      );
    });

    // New version combines teams and users into one section
    const dropdownItems: ItemsBeforeFilter = this.hasStreamlineTargeting()
      ? [
          {
            label: this.renderDropdownGroupLabel(t('Everyone Else')),
            hideGroupLabel: !filteredSuggestedAssignees.length,
            id: 'everyone-else',
            items: [...filteredSessionUser, ...filteredTeams, ...filteredMembers],
          },
        ]
      : [
          {
            label: this.renderDropdownGroupLabel(t('Teams')),
            id: 'team-header',
            items: filteredTeams,
          },
          {
            label: this.renderDropdownGroupLabel(t('People')),
            id: 'members-header',
            items: filteredMembers,
          },
        ];

    if (suggestedAssignees.length || filteredSessionUser.length) {
      // Add suggested assingees
      if (this.hasStreamlineTargeting()) {
        dropdownItems.unshift({
          label: this.renderDropdownGroupLabel(t('Suggested Assignees')),
          id: 'suggested-list',
          items: filteredSuggestedAssignees,
        });
      } else {
        dropdownItems.unshift(
          // session user is first on dropdown
          {
            label: this.renderDropdownGroupLabel(t('Suggested')),
            id: 'suggested-header',
            items: filteredSessionUser,
          },
          {
            hideGroupLabel: true,
            id: 'suggested-list',
            items: filteredSuggestedAssignees,
          }
        );
      }
    }

    return dropdownItems;
  }

  renderInviteMemberLink() {
    const loading = GroupStore.hasStatus(this.props.group.id, 'assignTo');

    return (
      <InviteMemberLink
        to="#invite-member"
        data-test-id="invite-member"
        disabled={loading}
        onClick={event => {
          event.preventDefault();
          openInviteMembersModal({source: 'assignee_selector'});
        }}
      >
        <MenuItemFooterWrapper>
          <IconContainer>
            <IconAdd color="activeText" isCircled legacySize="14px" />
          </IconContainer>
          <Label>{t('Invite Member')}</Label>
        </MenuItemFooterWrapper>
      </InviteMemberLink>
    );
  }

  getSuggestedAssignees(): SuggestedAssignee[] {
    const assignableTeams = this.assignableTeams();
    const memberList = this.memberList() ?? [];

    const {owners, group} = this.props;
    if (owners !== undefined) {
      // Add team or user from store
      return owners
        .map<SuggestedAssignee | null>(owner => {
          if (owner.type === 'user') {
            const member = memberList.find(user => user.id === owner.id);
            if (member) {
              return {
                ...owner,
                assignee: member,
              };
            }
          }
          if (owner.type === 'team') {
            const matchingTeam = assignableTeams.find(
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

    if (!group.owners) {
      return [];
    }

    const suggestedAssignees: Array<SuggestedAssignee | null> = group.owners.map(
      owner => {
        // converts a backend suggested owner to a suggested assignee
        const [ownerType, id] = owner.owner.split(':');
        if (ownerType === 'user') {
          const member = memberList.find(user => user.id === id);
          if (member) {
            return {
              id,
              type: 'user',
              name: member.name,
              suggestedReason: owner.type,
              assignee: member,
            };
          }
        } else if (ownerType === 'team') {
          const matchingTeam = assignableTeams.find(
            assignableTeam => assignableTeam.id === owner.owner
          );
          if (matchingTeam) {
            return {
              id,
              type: 'team',
              name: matchingTeam.team.name,
              suggestedReason: owner.type,
              assignee: matchingTeam,
            };
          }
        }

        return null;
      }
    );

    return suggestedAssignees.filter((owner): owner is SuggestedAssignee => !!owner);
  }

  render() {
    const {disabled, children, group} = this.props;
    const memberList = this.memberList();
    const loading = GroupStore.hasStatus(group.id, 'assignTo');

    const suggestedAssignees = this.getSuggestedAssignees();

    return (
      <DropdownAutoComplete
        disabled={disabled}
        maxHeight={400}
        onOpen={e => {
          // This can be called multiple times and does not always have `event`
          e?.stopPropagation();
        }}
        busy={memberList === undefined}
        items={memberList !== undefined ? this.renderNewDropdownItems() : null}
        alignMenu="right"
        onSelect={this.handleAssign}
        itemSize="small"
        searchPlaceholder={t('Filter teams and people')}
        menuFooter={
          group.assignedTo ? (
            <div>
              <MenuItemFooterWrapper role="button" onClick={this.clearAssignTo}>
                <IconContainer>
                  <IconClose color="activeText" isCircled legacySize="14px" />
                </IconContainer>
                <Label>{t('Clear Assignee')}</Label>
              </MenuItemFooterWrapper>
              {this.renderInviteMemberLink()}
            </div>
          ) : (
            this.renderInviteMemberLink()
          )
        }
        disableLabelPadding
        emptyHidesInput
      >
        {({getActorProps, isOpen}) =>
          children({
            loading,
            isOpen,
            getActorProps,
            suggestedAssignees,
          })
        }
      </DropdownAutoComplete>
    );
  }
}

export function putSessionUserFirst(members: User[] | undefined): User[] {
  // If session user is in the filtered list of members, put them at the top
  if (!members) {
    return [];
  }

  const sessionUser = ConfigStore.get('user');
  const sessionUserIndex = members.findIndex(member => member.id === sessionUser?.id);

  if (sessionUserIndex === -1) {
    return members;
  }

  const arrangedMembers = [members[sessionUserIndex]];
  arrangedMembers.push(...members.slice(0, sessionUserIndex));
  arrangedMembers.push(...members.slice(sessionUserIndex + 1));

  return arrangedMembers;
}

const IconContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
`;

const MenuItemWrapper = styled('div')<{
  disabled?: boolean;
  py?: number;
}>`
  cursor: ${p => (p.disabled ? 'not-allowed' : 'pointer')};
  display: flex;
  align-items: center;
  font-size: 13px;
  padding: ${space(0.5)} ${space(0.5)};
  ${p =>
    typeof p.py !== 'undefined' &&
    `
      padding-top: ${p.py};
      padding-bottom: ${p.py};
    `};
`;

const MenuItemFooterWrapper = styled('div')`
  display: flex;
  align-items: center;
  padding: ${space(0.25)} ${space(1)};
  border-top: 1px solid ${p => p.theme.innerBorder};
  background-color: ${p => p.theme.tag.highlight.background};
  color: ${p => p.theme.activeText};
  :hover {
    color: ${p => p.theme.activeHover};
    svg {
      fill: ${p => p.theme.activeHover};
    }
  }
`;

const InviteMemberLink = styled(Link)`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.textColor)};
`;

const Label = styled(TextOverflow)`
  margin-left: 6px;
`;

const AssigneeLabel = styled('div')`
  ${p => p.theme.overflowEllipsis}
  margin-left: ${space(1)};
  max-width: 300px;
`;

const GroupHeader = styled('div')`
  font-size: 75%;
  line-height: 1.5;
  font-weight: 600;
  text-transform: uppercase;
  margin: ${space(1)} 0;
  color: ${p => p.theme.subText};
  text-align: left;
`;

const SuggestedReason = styled('span')`
  color: ${p => p.theme.subText};
`;
