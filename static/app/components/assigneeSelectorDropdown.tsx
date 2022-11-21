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
import type {Actor, SuggestedOwner, SuggestedOwnerReason, Team, User} from 'sentry/types';
import {buildTeamId, buildUserId, valueIsEqual} from 'sentry/utils';

export type SuggestedAssignee = Actor & {
  assignee: AssignableTeam | User;
  suggestedReason: SuggestedOwnerReason;
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
  assignedTo?: Actor;
};

export interface AssigneeSelectorDropdownProps {
  children: (props: RenderProps) => React.ReactNode;
  id: string;
  disabled?: boolean;
  memberList?: User[];
  onAssign?: (
    type: Actor['type'],
    assignee: User | Actor,
    suggestedAssignee?: SuggestedAssignee
  ) => void;
}

type State = {
  loading: boolean;
  assignedTo?: Actor;
  memberList?: User[];
  suggestedOwners?: SuggestedOwner[] | null;
};

export class AssigneeSelectorDropdown extends Component<
  AssigneeSelectorDropdownProps,
  State
> {
  state = this.getInitialState();

  getInitialState() {
    const group = GroupStore.get(this.props.id);
    const memberList = MemberListStore.loaded ? MemberListStore.getAll() : undefined;
    const loading = GroupStore.hasStatus(this.props.id, 'assignTo');
    const suggestedOwners = group?.owners;

    return {
      assignedTo: group?.assignedTo,
      memberList,
      loading,
      suggestedOwners,
    };
  }

  componentWillReceiveProps(nextProps: AssigneeSelectorDropdownProps) {
    const loading = GroupStore.hasStatus(nextProps.id, 'assignTo');
    if (nextProps.id !== this.props.id || loading !== this.state.loading) {
      const group = GroupStore.get(this.props.id);
      this.setState({
        loading,
        assignedTo: group?.assignedTo,
        suggestedOwners: group?.owners,
      });
    }
  }

  shouldComponentUpdate(nextProps: AssigneeSelectorDropdownProps, nextState: State) {
    if (nextState.loading !== this.state.loading) {
      return true;
    }

    // If the memberList in props has changed, re-render as
    // props have updated, and we won't use internal state anyways.
    if (
      nextProps.memberList &&
      !valueIsEqual(this.props.memberList, nextProps.memberList)
    ) {
      return true;
    }

    const currentMembers = this.memberList();
    // XXX(billyvg): this means that once `memberList` is not-null, this component will never update due to `memberList` changes
    // Note: this allows us to show a "loading" state for memberList, but only before `MemberListStore.loadInitialData`
    // is called
    if (currentMembers === undefined && nextState.memberList !== currentMembers) {
      return true;
    }
    return !valueIsEqual(nextState.assignedTo, this.state.assignedTo, true);
  }

  componentWillUnmount() {
    this.unlisteners.forEach(unlistener => unlistener?.());
  }

  unlisteners = [
    GroupStore.listen(itemIds => this.onGroupChange(itemIds), undefined),
    MemberListStore.listen((users: User[]) => {
      this.handleMemberListUpdate(users);
    }, undefined),
  ];

  handleMemberListUpdate = (members: User[]) => {
    if (members === this.state.memberList) {
      return;
    }

    this.setState({memberList: members});
  };

  memberList(): User[] | undefined {
    return this.props.memberList ?? this.state.memberList;
  }

  onGroupChange(itemIds: Set<string>) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    const group = GroupStore.get(this.props.id);
    this.setState({
      assignedTo: group?.assignedTo,
      suggestedOwners: group?.owners,
      loading: GroupStore.hasStatus(this.props.id, 'assignTo'),
    });
  }

  assignableTeams(): AssignableTeam[] {
    const group = GroupStore.get(this.props.id);
    if (!group) {
      return [];
    }

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
    assignToUser({id: this.props.id, user, assignedBy: 'assignee_selector'});
    this.setState({loading: true});
  }

  assignToTeam(team: Team) {
    assignToActor({
      actor: {id: team.id, type: 'team'},
      id: this.props.id,
      assignedBy: 'assignee_selector',
    });
    this.setState({loading: true});
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
    clearAssignment(this.props.id, 'assignee_selector');
    this.setState({loading: true});
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
            <UserAvatar user={member} size={20} />
          </IconContainer>
          <Label>
            <Highlight text={inputValue}>
              {sessionUser.id === member.id
                ? `${member.name || member.email} ${t('(You)')}`
                : member.name || member.email}
            </Highlight>
            {suggestedReason && <SuggestedReason>({suggestedReason})</SuggestedReason>}
          </Label>
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
            <TeamAvatar team={team} size={20} />
          </IconContainer>
          <Label>
            <Highlight text={inputValue}>{display}</Highlight>
            {suggestedReason && <SuggestedReason>({suggestedReason})</SuggestedReason>}
          </Label>
        </MenuItemWrapper>
      ),
    };
  }

  renderNewTeamNodes(): ItemsBeforeFilter {
    return this.assignableTeams().map(team => this.renderTeamNode(team));
  }

  renderSuggestedAssigneeNodes(): React.ComponentProps<
    typeof DropdownAutoComplete
  >['items'] {
    const {assignedTo} = this.state;
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
        const reason = textReason[suggestedReason];
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
    const teams = this.renderNewTeamNodes();
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

    const dropdownItems: ItemsBeforeFilter = [
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

    // session user is first on dropdown
    if (suggestedAssignees.length || filteredSessionUser.length) {
      dropdownItems.unshift(
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

    return dropdownItems;
  }

  renderInviteMemberLink() {
    const {loading} = this.state;

    return (
      <InviteMemberLink
        to=""
        data-test-id="invite-member"
        disabled={loading}
        onClick={() => openInviteMembersModal({source: 'assignee_selector'})}
      >
        <MenuItemFooterWrapper>
          <IconContainer>
            <IconAdd color="activeText" isCircled size="14px" />
          </IconContainer>
          <Label>{t('Invite Member')}</Label>
        </MenuItemFooterWrapper>
      </InviteMemberLink>
    );
  }

  getSuggestedAssignees(): SuggestedAssignee[] {
    const {suggestedOwners} = this.state;
    if (!suggestedOwners) {
      return [];
    }

    const assignableTeams = this.assignableTeams();
    const memberList = this.memberList() ?? [];
    const suggestedAssignees: Array<SuggestedAssignee | null> = suggestedOwners.map(
      owner => {
        // converts a backend suggested owner to a suggested assignee
        const [ownerType, id] = owner.owner.split(':');
        if (ownerType === 'user') {
          const member = memberList.find(user => user.id === id);
          if (member) {
            return {
              type: 'user',
              id,
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
              type: 'team',
              id,
              name: matchingTeam.team.name,
              suggestedReason: owner.type,
              assignee: matchingTeam,
            };
          }
        }

        return null;
      }
    );

    return suggestedAssignees.filter(owner => !!owner) as SuggestedAssignee[];
  }

  render() {
    const {disabled, children} = this.props;
    const {loading, assignedTo} = this.state;
    const memberList = this.memberList();

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
          assignedTo ? (
            <div>
              <MenuItemFooterWrapper role="button" onClick={this.clearAssignTo} py={0}>
                <IconContainer>
                  <IconClose color="activeText" isCircled size="14px" />
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
            assignedTo,
            suggestedAssignees: this.getSuggestedAssignees(),
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
  ${p =>
    typeof p.py !== 'undefined' &&
    `
      padding-top: ${p.py};
      padding-bottom: ${p.py};
    `};
`;

const MenuItemFooterWrapper = styled(MenuItemWrapper)`
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

const GroupHeader = styled('div')`
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: 600;
  margin: ${space(1)} 0;
  color: ${p => p.theme.subText};
  line-height: ${p => p.theme.fontSizeSmall};
  text-align: left;
`;

const SuggestedReason = styled('span')`
  margin-left: ${space(0.5)};
  color: ${p => p.theme.textColor};
`;
