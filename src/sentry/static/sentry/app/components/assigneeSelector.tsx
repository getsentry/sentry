import React from 'react';
import PropTypes from 'prop-types';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {t, tn} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {Group, Member, Project, User, Team} from 'app/types';
import {buildUserId, buildTeamId, valueIsEqual} from 'app/utils';

import {assignToUser, assignToActor, clearAssignment} from 'app/actionCreators/group';
import ConfigStore from 'app/stores/configStore';
import GroupStore from 'app/stores/groupStore';
import MemberListStore from 'app/stores/memberListStore';
import ProjectsStore from 'app/stores/projectsStore';

import ActorAvatar from 'app/components/avatar/actorAvatar';
import Avatar from 'app/components/avatar';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import DropdownBubble from 'app/components/dropdownBubble';
import Highlight from 'app/components/highlight';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';

type Props = {
  id: string | string[] | null;
  size: number;
  memberList?: Member[];

  // Props to overwrite defaults on Dropdown child
  dropdownProps?: DropdownAutoComplete.propTypes;
  dropdownActor?: React.ComponentType | React.ReactNode;

  // Props specific to bulk-assign issues
  bulkAssign?: {
    numIssues: number;
    update: (data: {[key: string]: string}) => void;
  };
};

type State = {
  loading: boolean;
  assignedTo: User | null;
  memberList: Member[] | null;
};

const AssigneeSelectorComponent = createReactClass<Props, State>({
  displayName: 'AssigneeSelector',

  propTypes: {
    id: PropTypes.oneOfType([PropTypes.string, PropTypes.arrayOf(PropTypes.string)]),
    size: PropTypes.number,

    // Either a list of users, or null. If null, members will
    // be read from the MemberListStore. The prop is useful when the
    // store contains more/different users than you need to show
    // in an individual component, eg. Org Issue list
    memberList: PropTypes.array,

    dropdownProps: PropTypes.object,
    dropdownActor: PropTypes.node,

    bulkAssign: PropTypes.object,
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
    const state = {
      loading: false,
      assignedTo: null,
      memberList: MemberListStore.loaded ? MemberListStore.getAll() : null,
    };

    const {id} = this.props;
    if (id) {
      const group = GroupStore.get(id);
      state.assignedTo = group && group.assignedTo;
      state.loading = GroupStore.hasStatus(id, 'assignTo');
    }

    return state;
  },

  componentWillReceiveProps(nextProps) {
    // Update the state only when we are assigning 1 issue
    if (typeof this.props.id !== 'string' || typeof nextProps.id !== 'string') {
      return;
    }

    const loading = GroupStore.hasStatus(nextProps.id, 'assignTo');

    if (loading !== this.state.loading || nextProps.id !== this.props.id) {
      const group = GroupStore.get(nextProps.id);
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

    if (nextProps.id && !valueIsEqual(this.props.id, nextProps.id)) {
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
    if (currentMembers === null && nextState.memberList !== currentMembers) {
      return true;
    }
    return !valueIsEqual(nextState.assignedTo, this.state.assignedTo, true);
  },

  memberList() {
    return this.props.memberList ? this.props.memberList : this.state.memberList;
  },

  assignableTeams() {
    if (!this.props.id) {
      return [];
    }

    const groupIds: string[] =
      typeof this.props.id === 'string' ? [this.props.id] : this.props.id;

    // Use this to prevent duplicates and flatten it at the end
    const teams: {
      [id: string]: Team;
    } = {};
    groupIds.forEach(id => {
      const group: Group = GroupStore.get(id);
      if (!group) {
        return;
      }

      const project: Project = ProjectsStore.getBySlug(group.project.slug);
      if (!project) {
        return;
      }

      project.teams.forEach(team => {
        teams[team.id] = team;
      });
    });

    // Flatten Team object into array
    return Object.keys(teams).map(id => {
      const team = teams[id];

      return {
        id: buildTeamId(team.id),
        display: `#${team.slug}`,
        email: team.id,
        team,
      };
    });
  },

  onGroupChange(itemIds) {
    if (!this.props.id || !itemIds.has(this.props.id)) {
      return;
    }

    const group = GroupStore.get(this.props.id);
    this.setState({
      assignedTo: group && group.assignedTo,
      loading: GroupStore.hasStatus(this.props.id, 'assignTo'),
    });
  },

  setAssignedToUser(user: User) {
    assignToUser({id: this.props.id, user});
    this.setState({loading: true});
  },

  setAssignedToTeam(team: Team) {
    assignToActor({actor: {id: team.id, type: 'team'}, id: this.props.id});
    this.setState({loading: true});
  },

  setManyAssignedToUser(user: User) {
    // TODO(ts): Wonky type-inference from create-react-class
    const {bulkAssign} = this.props as any;
    const userId = buildUserId(user.id);

    this.setState({loading: true});
    bulkAssign.update({assignedTo: userId}, () => {
      this.setState({loading: false});
    });
  },

  setManyAssignedToTeam(team: Team) {
    // TODO(ts): Wonky type-inference from create-react-class
    const {bulkAssign} = this.props as any;
    const teamId = buildTeamId(team.id);

    this.setState({loading: true});
    bulkAssign.update({assignedTo: teamId}, () => {
      this.setState({loading: false});
    });
  },

  handleAssign({value: {type, assignee}}, _state, e) {
    // TODO(ts): Wonky type-inference from create-react-class
    const {bulkAssign} = this.props as any;

    if (type === 'member') {
      if (bulkAssign) {
        this.setManyAssignedToUser(assignee);
      } else {
        this.setAssignedToUser(assignee);
      }
    }

    if (type === 'team') {
      if (bulkAssign) {
        this.setManyAssignedToTeam(assignee);
      } else {
        this.setAssignedToTeam(assignee);
      }
    }

    e.stopPropagation();
  },

  unsetAssignedTo(e) {
    // clears assignment
    clearAssignment(this.props.id);
    this.setState({loading: true});
    e.stopPropagation();
  },

  unsetManyAssignedTo() {
    // TODO(ts): Wonky type-inference from create-react-class
    const {bulkAssign} = this.props as any;

    this.setState({loading: true});
    bulkAssign.update({assignedTo: ''}, () => {
      this.setState({loading: false});
    });
  },

  renderNewMemberNodes() {
    const {size} = this.props;
    const members = putSessionUserFirst(this.memberList());

    return members.map(member => {
      return {
        value: {type: 'member', assignee: member},
        searchKey: `${member.email} ${member.name}`,
        label: ({inputValue}) => (
          <MenuItemWrapper
            data-test-id="assignee-option"
            key={buildUserId(member.id)}
            onSelect={this.setAssignedToUser.bind(this, member)}
          >
            <IconContainer>
              <Avatar user={member} size={size} />
            </IconContainer>
            <Label>
              <Highlight text={inputValue}>{member.name || member.email}</Highlight>
            </Label>
          </MenuItemWrapper>
        ),
      };
    });
  },

  renderNewTeamNodes() {
    const {size} = this.props;

    return this.assignableTeams().map(({id, display, team}) => {
      return {
        value: {type: 'team', assignee: team},
        searchKey: team.slug,
        label: ({inputValue}) => (
          <MenuItemWrapper
            data-test-id="assignee-option"
            key={id}
            onSelect={this.setAssignedToTeam.bind(this, team)}
          >
            <IconContainer>
              <Avatar team={team} size={size} />
            </IconContainer>
            <Label>
              <Highlight text={inputValue}>{display}</Highlight>
            </Label>
          </MenuItemWrapper>
        ),
      };
    });
  },

  renderNewDropdownItems() {
    const teams = this.renderNewTeamNodes();
    const members = this.renderNewMemberNodes();

    return [
      {id: 'team-header', hideGroupLabel: true, items: teams},
      {id: 'members-header', items: members},
    ];
  },

  renderDropdownButton({getActorProps}) {
    // TODO(ts): Wonky type-inference from create-react-class
    const {dropdownActor} = this.props as any;
    const {assignedTo} = this.state;

    return dropdownActor ? (
      dropdownActor
    ) : (
      <DropdownButton {...getActorProps({})}>
        {assignedTo ? (
          <ActorAvatar actor={assignedTo} className="avatar" size={24} />
        ) : (
          <IconUser src="icon-user" />
        )}
        <StyledChevron src="icon-chevron-down" />
      </DropdownButton>
    );
  },

  render() {
    // TODO(ts): Wonky type-inference from create-react-class
    const {className, bulkAssign, dropdownProps} = this.props as any;
    const {organization} = this.context;
    const {loading, assignedTo} = this.state;
    const canInvite = ConfigStore.get('invitesEnabled');
    const hasOrgWrite = organization.access.includes('org:write');
    const memberList = this.memberList();

    return (
      <div className={className}>
        {loading && (
          <LoadingIndicator mini style={{height: '24px', margin: 0, marginRight: 11}} />
        )}
        {!loading && (
          <DropdownAutoComplete
            maxHeight={400}
            zIndex={2}
            onOpen={e => {
              // This can be called multiple times and does not always have `event`
              if (!e) {
                return;
              }
              e.stopPropagation();
            }}
            busy={memberList === null}
            items={memberList !== null ? this.renderNewDropdownItems() : null}
            alignMenu="right"
            onSelect={this.handleAssign}
            itemSize="small"
            searchPlaceholder={t('Filter teams and people')}
            menuWithArrow
            emptyHidesInput
            allowHoverToggle={false}
            menuHeader={
              (bulkAssign || assignedTo) && (
                <MenuItemWrapper
                  data-test-id="clear-assignee"
                  onClick={bulkAssign ? this.unsetManyAssignedTo : this.unsetAssignedTo}
                  py={0}
                >
                  <IconContainer>
                    <ClearAssigneeIcon />
                  </IconContainer>
                  <Label>
                    {bulkAssign
                      ? tn(
                          'Unassign %s issue',
                          'Unassign %s issues',
                          bulkAssign.numIssues
                        )
                      : t('Clear Assignee')}
                  </Label>
                </MenuItemWrapper>
              )
            }
            menuFooter={
              canInvite &&
              hasOrgWrite && (
                <InviteMemberLink
                  data-test-id="invite-member"
                  disabled={loading}
                  to={`/settings/${
                    this.context.organization.slug
                  }/members/new/?referrer=assignee_selector`}
                >
                  <MenuItemWrapper>
                    <IconContainer>
                      <InviteMemberIcon />
                    </IconContainer>
                    <Label>{t('Invite Member')}</Label>
                  </MenuItemWrapper>
                </InviteMemberLink>
              )
            }
            {...dropdownProps}
          >
            {this.props.children ? this.props.children : this.renderDropdownButton}
          </DropdownAutoComplete>
        )}
      </div>
    );
  },
});

export function putSessionUserFirst(members: Member[]): Member[] {
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

const getSvgStyle = () => `
  font-size: 16px;
  opacity: 0.3;
`;

const IconUser = styled(InlineSvg)`
  color: ${p => p.theme.gray3};
  height: 20px;
  width: 20px;

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
}>`
  cursor: pointer;
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
  padding: 0 !important; /* Due to inconsistent styles when used as a child of <li> */
  color: ${p => p.theme.textColor};
`;

const Label = styled(TextOverflow)`
  margin-left: 6px;
`;

const ClearAssigneeIcon = styled(props => (
  <InlineSvg {...props} src="icon-circle-close" />
))`
  ${getSvgStyle};
`;

const InviteMemberIcon = styled(props => <InlineSvg {...props} src="icon-circle-add" />)`
  ${getSvgStyle};
`;

const StyledChevron = styled(InlineSvg)`
  margin-left: ${space(1)};
  width: 12px;
  height: 12px;
`;

const DropdownButton = styled('div')`
  display: flex;
  align-items: center;
  font-size: 20px;
`;
