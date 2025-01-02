import {Component} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import uniqBy from 'lodash/uniqBy';

import {assignToActor, assignToUser, clearAssignment} from 'sentry/actionCreators/group';
import {openInviteMembersModal} from 'sentry/actionCreators/modal';
import TeamAvatar from 'sentry/components/avatar/teamAvatar';
import UserAvatar from 'sentry/components/avatar/userAvatar';
import type {GetActorPropsFn} from 'sentry/components/deprecatedDropdownMenu';
import DropdownAutoComplete from 'sentry/components/dropdownAutoComplete';
import type {ItemsBeforeFilter} from 'sentry/components/dropdownAutoComplete/types';
import Link from 'sentry/components/links/link';
import TextOverflow from 'sentry/components/textOverflow';
import {IconAdd, IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import MemberListStore from 'sentry/stores/memberListStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {Actor} from 'sentry/types/core';
import type {Group, SuggestedOwner, SuggestedOwnerReason} from 'sentry/types/group';
import type {Organization, Team} from 'sentry/types/organization';
import type {User} from 'sentry/types/user';
import {buildTeamId, buildUserId} from 'sentry/utils';
import type {FeedbackIssue} from 'sentry/utils/feedback/types';
import {valueIsEqual} from 'sentry/utils/object/valueIsEqual';

const suggestedReasonTable: Record<SuggestedOwnerReason, string> = {
  suspectCommit: t('Suspect Commit'),
  ownershipRule: t('Ownership Rule'),
  projectOwnership: t('Ownership Rule'),
  // TODO: codeowners may no longer exist
  codeowners: t('Codeowners'),
};

const onOpenNoop = (e?: React.MouseEvent) => {
  e?.stopPropagation();

  Sentry.withScope(scope => {
    const span = Sentry.startInactiveSpan({
      name: 'assignee_selector_dropdown.open',
      op: 'ui.render',
      forceTransaction: true,
    });

    if (!span) {
      return;
    }

    if (typeof window.requestIdleCallback === 'function') {
      scope.setTag('finish_strategy', 'idle_callback');
      window.requestIdleCallback(() => {
        span.end();
      });
    } else {
      scope.setTag('finish_strategy', 'timeout');
      setTimeout(() => {
        span.end();
      }, 1_000);
    }
  });
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

type RenderProps = {
  getActorProps: GetActorPropsFn;
  isOpen: boolean;
  loading: boolean;
  suggestedAssignees: SuggestedAssignee[];
};

export type OnAssignCallback = (
  type: Actor['type'],
  assignee: User | Actor,
  suggestedAssignee?: SuggestedAssignee
) => void;

export interface DeprecatedAssigneeSelectorDropdownProps {
  children: (props: RenderProps) => React.ReactNode;
  id: string;
  organization: Organization;
  alignMenu?: 'left' | 'right' | undefined;
  assignedTo?: Actor | null;
  disabled?: boolean;
  group?: Group | FeedbackIssue;
  memberList?: User[];
  onAssign?: OnAssignCallback;
  onClear?: () => void;
  owners?: Omit<SuggestedAssignee, 'assignee'>[];
}

type State = {
  loading: boolean;
  memberList?: User[];
  suggestedOwners?: SuggestedOwner[] | null;
};

/**
 * @deprecated use AssigneeSelectorDropdown instead (Coming in future PR)
 */

export class DeprecatedAssigneeSelectorDropdown extends Component<
  DeprecatedAssigneeSelectorDropdownProps,
  State
> {
  state = this.getInitialState();

  getInitialState() {
    const group = GroupStore.get(this.props.id);
    const memberList = MemberListStore.state.loading
      ? undefined
      : MemberListStore.getAll();

    const loading = GroupStore.hasStatus(this.props.id, 'assignTo');
    const suggestedOwners = group?.owners;

    return {
      assignedTo: group?.assignedTo,
      memberList,
      loading,
      suggestedOwners,
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps: DeprecatedAssigneeSelectorDropdownProps) {
    const loading = GroupStore.hasStatus(nextProps.id, 'assignTo');
    if (nextProps.id !== this.props.id || loading !== this.state.loading) {
      const group = GroupStore.get(this.props.id);
      this.setState({
        loading,
        suggestedOwners: group?.owners,
      });
    }
  }

  shouldComponentUpdate(
    nextProps: DeprecatedAssigneeSelectorDropdownProps,
    nextState: State
  ) {
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

    if (!valueIsEqual(this.props.owners, nextProps.owners)) {
      return true;
    }

    const currentMembers = this.memberList();
    // XXX(billyvg): this means that once `memberList` is not-null, this component will never update due to `memberList` changes
    // Note: this allows us to show a "loading" state for memberList, but only before `MemberListStore.loadInitialData`
    // is called
    if (currentMembers === undefined && nextState.memberList !== currentMembers) {
      return true;
    }
    return !valueIsEqual(this.props.assignedTo, nextProps.assignedTo, true);
  }

  componentWillUnmount() {
    this.unlisteners.forEach(unlistener => unlistener?.());
  }

  unlisteners = [
    GroupStore.listen(itemIds => this.onGroupChange(itemIds), undefined),
    MemberListStore.listen(({members}: typeof MemberListStore.state) => {
      this.handleMemberListUpdate(members);
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
      suggestedOwners: group?.owners,
      loading: GroupStore.hasStatus(this.props.id, 'assignTo'),
    });
  }

  assignableTeams(): AssignableTeam[] {
    const group = GroupStore.get(this.props.id) ?? this.props.group;
    if (!group) {
      return [];
    }

    const teams = ProjectsStore.getBySlug(group.project?.slug)?.teams ?? [];
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
    const {organization} = this.props;
    assignToUser({
      id: this.props.id,
      orgSlug: organization.slug,
      user,
      assignedBy: 'assignee_selector',
    });
    this.setState({loading: true});
  }

  // Renamed to handleTeamAssign
  assignToTeam(team: Team) {
    const {organization} = this.props;

    assignToActor({
      actor: {id: team.id, type: 'team'},
      id: this.props.id,
      orgSlug: organization.slug,
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
      onAssign(type, assignee, suggestion);
    }
  };

  clearAssignTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const {organization} = this.props;

    // clears assignment
    clearAssignment(this.props.id, organization.slug, 'assignee_selector');
    this.setState({loading: true});
    const {onClear} = this.props;

    if (onClear) {
      onClear();
    }
    e.stopPropagation();
  };

  renderMemberNode(
    member: User,
    suggestedReason?: React.ReactNode
  ): ItemsBeforeFilter[0] {
    const sessionUser = ConfigStore.get('user');
    const handleSelect = () => this.assignToUser(member);

    return {
      value: {type: 'member', assignee: member},
      searchKey: `${member.email} ${member.name}`,
      label: (
        <MenuItemWrapper
          data-test-id="assignee-option"
          key={buildUserId(member.id)}
          onSelect={handleSelect}
        >
          <IconContainer>
            <UserAvatar user={member} size={24} />
          </IconContainer>
          <div>
            <AssigneeLabel>
              {sessionUser.id === member.id
                ? `${member.name || member.email} ${t('(You)')}`
                : member.name || member.email}
            </AssigneeLabel>
            {suggestedReason && (
              <SuggestedAssigneeReason>{suggestedReason}</SuggestedAssigneeReason>
            )}
          </div>
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
    suggestedReason?: React.ReactNode
  ): ItemsBeforeFilter[0] {
    const {id, display, team} = assignableTeam;

    const handleSelect = () => this.assignToTeam(team);

    return {
      value: {type: 'team', assignee: team},
      searchKey: team.slug,
      label: (
        <MenuItemWrapper data-test-id="assignee-option" key={id} onSelect={handleSelect}>
          <IconContainer>
            <TeamAvatar team={team} size={24} />
          </IconContainer>
          <div>
            <AssigneeLabel>{display}</AssigneeLabel>
            {suggestedReason && (
              <SuggestedAssigneeReason>{suggestedReason}</SuggestedAssigneeReason>
            )}
          </div>
        </MenuItemWrapper>
      ),
    };
  }

  renderSuggestedAssigneeNodes(): React.ComponentProps<
    typeof DropdownAutoComplete
  >['items'] {
    const {assignedTo} = this.props;
    // filter out suggested assignees if a suggestion is already selected
    const suggestedAssignees = this.getSuggestedAssignees();
    const renderedAssignees: (
      | ReturnType<DeprecatedAssigneeSelectorDropdown['renderTeamNode']>
      | ReturnType<DeprecatedAssigneeSelectorDropdown['renderMemberNode']>
    )[] = [];

    for (let i = 0; i < suggestedAssignees.length; i++) {
      const assignee = suggestedAssignees[i]!;
      if (assignee.type !== 'user' && assignee.type !== 'team') {
        continue;
      }
      if (!(assignee.type !== assignedTo?.type && assignee.id !== assignedTo?.id)) {
        continue;
      }

      renderedAssignees.push(
        assignee.type === 'user'
          ? this.renderMemberNode(assignee.assignee as User, assignee.suggestedReasonText)
          : this.renderTeamNode(
              assignee.assignee as AssignableTeam,
              assignee.suggestedReasonText
            )
      );
    }

    return renderedAssignees;
  }

  renderDropdownGroupLabel(label: string) {
    return <GroupHeader>{label}</GroupHeader>;
  }

  renderNewDropdownItems(): ItemsBeforeFilter {
    const sessionUser = ConfigStore.get('user');
    const teams = this.assignableTeams().map(team => this.renderTeamNode(team));
    const members = this.renderNewMemberNodes();
    const suggestedAssignees = this.renderSuggestedAssigneeNodes() ?? [];

    const filteredSessionUser: ItemsBeforeFilter = members.filter(
      member => member.value.assignee.id === sessionUser.id
    );

    const assigneeIds = new Set(
      suggestedAssignees.map(
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
    const dropdownItems: ItemsBeforeFilter = [
      {
        label: this.renderDropdownGroupLabel(t('Everyone Else')),
        hideGroupLabel: !suggestedAssignees.length,
        id: 'everyone-else',
        items: filteredSessionUser.concat(filteredTeams, filteredMembers),
      },
    ];

    if (suggestedAssignees.length) {
      // Add suggested assingees
      dropdownItems.unshift({
        label: this.renderDropdownGroupLabel(t('Suggested Assignees')),
        id: 'suggested-list',
        items: suggestedAssignees,
      });
    }

    return dropdownItems;
  }

  renderInviteMemberLink() {
    return (
      <InviteMemberLink
        to="#invite-member"
        data-test-id="invite-member"
        disabled={this.state.loading}
        onClick={event => {
          event.preventDefault();
          openInviteMembersModal({source: 'assignee_selector'});
        }}
      >
        <MenuItemFooterWrapper>
          <IconContainer>
            <IconAdd color="activeText" isCircled size="sm" />
          </IconContainer>
          <Label>{t('Invite Member')}</Label>
        </MenuItemFooterWrapper>
      </InviteMemberLink>
    );
  }

  getSuggestedAssignees(): SuggestedAssignee[] {
    const assignableTeams = this.assignableTeams();
    const memberList = this.memberList() ?? [];

    const {owners} = this.props;
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

    const {suggestedOwners} = this.state;
    if (!suggestedOwners) {
      return [];
    }

    const uniqueSuggestions = uniqBy(suggestedOwners, owner => owner.owner);
    return uniqueSuggestions
      .map<SuggestedAssignee | null>(owner => {
        // converts a backend suggested owner to a suggested assignee
        const [ownerType, id] = owner.owner.split(':');
        const suggestedReasonText = suggestedReasonTable[owner.type];
        if (ownerType === 'user') {
          const member = memberList.find(user => user.id === id);
          if (member) {
            return {
              id: id!,
              type: 'user',
              name: member.name,
              suggestedReason: owner.type,
              suggestedReasonText,
              assignee: member,
            };
          }
        } else if (ownerType === 'team') {
          const matchingTeam = assignableTeams.find(
            assignableTeam => assignableTeam.id === owner.owner
          );
          if (matchingTeam) {
            return {
              id: id!,
              type: 'team',
              name: matchingTeam.team.name,
              suggestedReason: owner.type,
              suggestedReasonText,
              assignee: matchingTeam,
            };
          }
        }

        return null;
      })
      .filter((owner): owner is SuggestedAssignee => !!owner);
  }

  render() {
    const {alignMenu, disabled, children, assignedTo} = this.props;
    const {loading} = this.state;
    const memberList = this.memberList();

    return (
      <DropdownAutoComplete
        disabled={disabled}
        maxHeight={400}
        onOpen={onOpenNoop}
        busy={memberList === undefined}
        items={null}
        lazyItems={
          memberList !== undefined ? this.renderNewDropdownItems.bind(this) : () => null
        }
        onSelect={this.handleAssign}
        alignMenu={alignMenu ?? 'right'}
        itemSize="small"
        searchPlaceholder={t('Filter teams and people')}
        menuFooter={
          assignedTo ? (
            <div>
              <MenuItemFooterWrapper role="button" onClick={this.clearAssignTo}>
                <IconContainer>
                  <IconClose color="activeText" isCircled size="sm" />
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

  const arrangedMembers = [members[sessionUserIndex]!].concat(
    members.slice(0, sessionUserIndex),
    members.slice(sessionUserIndex + 1)
  );

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

const MenuItemWrapper = styled('div')`
  display: flex;
  align-items: center;
  font-size: 13px;
  padding: ${space(0.5)} ${space(0.5)};
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

const SuggestedAssigneeReason = styled(AssigneeLabel)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const GroupHeader = styled('div')`
  font-size: 75%;
  line-height: 1.5;
  font-weight: ${p => p.theme.fontWeightBold};
  text-transform: uppercase;
  margin: ${space(1)} 0;
  color: ${p => p.theme.subText};
  text-align: left;
`;
