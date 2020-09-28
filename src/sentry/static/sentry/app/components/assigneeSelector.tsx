import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from '@emotion/styled';

import SentryTypes from 'app/sentryTypes';
import {User} from 'app/types';
import {assignToUser, assignToActor, clearAssignment} from 'app/actionCreators/group';
import {openInviteMembersModal} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import {valueIsEqual, buildUserId, buildTeamId} from 'app/utils';
import ActorAvatar from 'app/components/avatar/actorAvatar';
import UserAvatar from 'app/components/avatar/userAvatar';
import TeamAvatar from 'app/components/avatar/teamAvatar';
import ConfigStore from 'app/stores/configStore';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownBubble from 'app/components/dropdownBubble';
import GroupStore from 'app/stores/groupStore';
import Highlight from 'app/components/highlight';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import MemberListStore from 'app/stores/memberListStore';
import ProjectsStore from 'app/stores/projectsStore';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';
import {IconAdd, IconClose, IconChevron, IconUser} from 'app/icons';

type Props = {
  id: string | null;
  size: number;
  memberList?: User[];
};

type State = {
  loading: boolean;
  assignedTo: User | undefined;
  memberList: User[] | undefined;
};

const AssigneeSelectorComponent = createReactClass<Props, State>({
  displayName: 'AssigneeSelector',

  propTypes: {
    id: PropTypes.string.isRequired,
    size: PropTypes.number,
    // Either a list of users, or null. If null, members will
    // be read from the MemberListStore. The prop is useful when the
    // store contains more/different users than you need to show
    // in an individual component, eg. Org Issue list
    memberList: PropTypes.array,
  },

  contextTypes: {
    organization: SentryTypes.Organization,
  },

  mixins: [
    Reflux.listenTo(GroupStore, 'onGroupChange') as any,
    Reflux.connect(MemberListStore, 'memberList') as any,
  ],

  getDefaultProps() {
    return {
      id: null,
      size: 20,
      memberList: undefined,
    };
  },

  getInitialState() {
    const group = GroupStore.get(this.props.id);
    const memberList = MemberListStore.loaded ? MemberListStore.getAll() : undefined;
    const loading = GroupStore.hasStatus(this.props.id, 'assignTo');

    return {
      assignedTo: group && group.assignedTo,
      memberList,
      loading,
    };
  },

  componentWillReceiveProps(nextProps) {
    const loading = nextProps.id && GroupStore.hasStatus(nextProps.id, 'assignTo');
    if (nextProps.id !== this.props.id || loading !== this.state.loading) {
      const group = GroupStore.get(this.props.id);
      this.setState({
        loading,
        assignedTo: group && group.assignedTo,
      });
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
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
  },

  memberList(): User[] | undefined {
    return this.props.memberList ? this.props.memberList : this.state.memberList;
  },

  assignableTeams() {
    if (!this.props.id) {
      return [];
    }
    const group = GroupStore.get(this.props.id);
    if (!group) {
      return [];
    }

    return (
      ProjectsStore.getBySlug(group.project.slug) || {
        teams: [],
      }
    ).teams
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(team => ({
        id: buildTeamId(team.id),
        display: `#${team.slug}`,
        email: team.id,
        team,
      }));
  },

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    const group = GroupStore.get(this.props.id);
    this.setState({
      assignedTo: group && group.assignedTo,
      loading: this.props.id && GroupStore.hasStatus(this.props.id, 'assignTo'),
    });
  },

  assignToUser(user) {
    assignToUser({id: this.props.id, user});
    this.setState({loading: true});
  },

  assignToTeam(team) {
    assignToActor({actor: {id: team.id, type: 'team'}, id: this.props.id});
    this.setState({loading: true});
  },

  handleAssign({value: {type, assignee}}, _state, e) {
    if (type === 'member') {
      this.assignToUser(assignee);
    }

    if (type === 'team') {
      this.assignToTeam(assignee);
    }

    e.stopPropagation();
  },

  clearAssignTo(e) {
    // clears assignment
    clearAssignment(this.props.id);
    this.setState({loading: true});
    e.stopPropagation();
  },

  renderNewMemberNodes() {
    const {size} = this.props;
    const members = putSessionUserFirst(this.memberList());

    return members.map(member => ({
      value: {type: 'member', assignee: member},
      searchKey: `${member.email} ${member.name}`,
      label: ({inputValue}) => (
        <MenuItemWrapper
          data-test-id="assignee-option"
          key={buildUserId(member.id)}
          onSelect={this.assignToUser.bind(this, member)}
        >
          <IconContainer>
            <UserAvatar user={member} size={size} />
          </IconContainer>
          <Label>
            <Highlight text={inputValue}>{member.name || member.email}</Highlight>
          </Label>
        </MenuItemWrapper>
      ),
    }));
  },

  renderNewTeamNodes() {
    const {size} = this.props;

    return this.assignableTeams().map(({id, display, team}) => ({
      value: {type: 'team', assignee: team},
      searchKey: team.slug,
      label: ({inputValue}) => (
        <MenuItemWrapper
          data-test-id="assignee-option"
          key={id}
          onSelect={this.assignToTeam.bind(this, team)}
        >
          <IconContainer>
            <TeamAvatar team={team} size={size} />
          </IconContainer>
          <Label>
            <Highlight text={inputValue}>{display}</Highlight>
          </Label>
        </MenuItemWrapper>
      ),
    }));
  },

  renderNewDropdownItems() {
    const teams = this.renderNewTeamNodes();
    const members = this.renderNewMemberNodes();

    return [
      {id: 'team-header', hideGroupLabel: true, items: teams},
      {id: 'members-header', items: members},
    ];
  },

  render() {
    const {className} = this.props;
    const {loading, assignedTo} = this.state;
    const memberList = this.memberList();

    return (
      <div className={className}>
        {loading && (
          <LoadingIndicator mini style={{height: '24px', margin: 0, marginRight: 11}} />
        )}
        {!loading && (
          <DropdownAutoComplete
            maxHeight={400}
            onOpen={e => {
              // This can be called multiple times and does not always have `event`
              if (!e) {
                return;
              }
              e.stopPropagation();
            }}
            busy={memberList === undefined}
            items={memberList !== undefined ? this.renderNewDropdownItems() : null}
            alignMenu="right"
            onSelect={this.handleAssign}
            itemSize="small"
            searchPlaceholder={t('Filter teams and people')}
            menuHeader={
              assignedTo && (
                <MenuItemWrapper
                  data-test-id="clear-assignee"
                  onClick={this.clearAssignTo}
                  py={0}
                >
                  <IconContainer>
                    <ClearAssigneeIcon isCircled size="14px" />
                  </IconContainer>
                  <Label>{t('Clear Assignee')}</Label>
                </MenuItemWrapper>
              )
            }
            menuFooter={
              <InviteMemberLink
                to=""
                data-test-id="invite-member"
                disabled={loading}
                onClick={() => openInviteMembersModal({source: 'assignee_selector'})}
              >
                <MenuItemWrapper>
                  <IconContainer>
                    <InviteMemberIcon isCircled size="14px" />
                  </IconContainer>
                  <Label>{t('Invite Member')}</Label>
                </MenuItemWrapper>
              </InviteMemberLink>
            }
            menuWithArrow
            emptyHidesInput
          >
            {({getActorProps}) => (
              <DropdownButton {...getActorProps({})}>
                {assignedTo ? (
                  <ActorAvatar actor={assignedTo} className="avatar" size={24} />
                ) : (
                  <StyledIconUser size="20px" color="gray600" />
                )}
                <StyledChevron direction="down" size="xs" />
              </DropdownButton>
            )}
          </DropdownAutoComplete>
        )}
      </div>
    );
  },
});

export function putSessionUserFirst(members: User[] | undefined): User[] {
  // If session user is in the filtered list of members, put them at the top
  if (!members) {
    return [];
  }

  const sessionUser = ConfigStore.get('user');
  const sessionUserIndex = members.findIndex(
    member => sessionUser && member.id === sessionUser.id
  );

  if (sessionUserIndex === -1) {
    return members;
  }

  const arrangedMembers = [members[sessionUserIndex]];
  arrangedMembers.push(...members.slice(0, sessionUserIndex));
  arrangedMembers.push(...members.slice(sessionUserIndex + 1));

  return arrangedMembers;
}

const AssigneeSelector = styled(AssigneeSelectorComponent)`
  display: flex;
  justify-content: flex-end;

  /* manually align menu underneath dropdown caret */
  ${DropdownBubble} {
    right: -14px;
  }
`;

export default AssigneeSelector;
export {AssigneeSelectorComponent};

const StyledIconUser = styled(IconUser)`
  /* We need this to center with Avatar */
  margin-right: 2px;
`;

const IconContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
`;

const MenuItemWrapper = styled('div')<{
  py?: number;
  disabled?: boolean;
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

const InviteMemberLink = styled(Link)`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.textColor)};
`;

const Label = styled(TextOverflow)`
  margin-left: 6px;
`;

const ClearAssigneeIcon = styled(IconClose)`
  opacity: 0.3;
`;

const InviteMemberIcon = styled(IconAdd)`
  opacity: 0.3;
`;

const StyledChevron = styled(IconChevron)`
  margin-left: ${space(1)};
`;

const DropdownButton = styled('div')`
  display: flex;
  align-items: center;
  font-size: 20px;
`;
